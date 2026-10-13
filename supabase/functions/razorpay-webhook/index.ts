import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3';

/**
 * Computes HMAC-SHA256 hex digest using Web Crypto API.
 */
async function computeHmacSha256(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time string equality to prevent timing attacks on webhook signatures.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

serve(async (req) => {
  // 1. Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 2. Strict Webhook & Database Configuration Check (Fail closed)
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET is unconfigured in server environment secrets');
      return new Response(JSON.stringify({ error: 'Webhook service unconfigured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase service role credentials missing for webhook processing');
      return new Response(JSON.stringify({ error: 'Database service unconfigured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Cryptographic Signature Verification
    const signature = req.headers.get('x-razorpay-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing webhook signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await req.text();
    const expectedSignature = await computeHmacSha256(webhookSecret, rawBody);

    if (!timingSafeEqual(expectedSignature, signature)) {
      console.warn('Invalid Razorpay webhook signature detected');
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Safe JSON Payload Parsing
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: 'Malformed JSON payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const event = payload.event;
    const eventDeliveryId = payload.entity_id || payload.account_id || req.headers.get('x-razorpay-event-id') || null;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Handle payment.captured Event
    if (event === 'payment.captured') {
      const paymentEntity = payload.payload?.payment?.entity;
      if (!paymentEntity) {
        return new Response(JSON.stringify({ error: 'Missing payment entity' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const rzpOrderId = (paymentEntity.order_id || '').trim();
      const rzpPaymentId = (paymentEntity.id || '').trim();
      const amountPaise = paymentEntity.amount;
      const currency = (paymentEntity.currency || 'INR').toUpperCase();
      const status = paymentEntity.status;

      if (!rzpOrderId || !rzpPaymentId || !amountPaise) {
        return new Response(JSON.stringify({ error: 'Missing critical payment attributes' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // STRICT STATUS: Must be 'captured'
      if (status !== 'captured') {
        console.warn(`Webhook received payment with status: ${status}, expected: captured`);
        return new Response(JSON.stringify({ error: `Payment status is ${status}, not captured` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Query authoritative invoice by razorpay_order_id
      const { data: invoice, error: invoiceErr } = await supabaseAdmin
        .from('invoices')
        .select('id, invoice_number, status, amount_paise, currency, order_id, orders!inner(client_id)')
        .eq('razorpay_order_id', rzpOrderId)
        .maybeSingle();

      if (invoiceErr || !invoice) {
        console.warn(`Webhook: invoice not found for razorpay_order_id: ${rzpOrderId}`);
        // Return 200 so Razorpay does not endlessly retry an unrecognized order from other systems
        return new Response(JSON.stringify({ received: true, note: 'Invoice not found in system' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Idempotency: If invoice is already 'Paid', verify it was settled with THIS gateway payment
      if (invoice.status === 'Paid') {
        const { data: existingPayment } = await supabaseAdmin
          .from('payments')
          .select('id, receipt_number')
          .eq('invoice_id', invoice.id)
          .eq('gateway_payment_id', rzpPaymentId)
          .maybeSingle();

        if (existingPayment) {
          return new Response(JSON.stringify({
            received: true,
            status: 'already_paid_idempotent',
            payment_id: existingPayment.id,
            receipt_number: existingPayment.receipt_number,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Paid under different payment ID
        console.error(`Invoice ${invoice.id} already Paid under different payment reference than ${rzpPaymentId}`);
        return new Response(JSON.stringify({
          error: 'Invoice is already settled under a different transaction reference',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Validate captured amount matches invoice amount exactly
      if (amountPaise !== invoice.amount_paise) {
        console.error(`Amount mismatch: gateway ${amountPaise} vs invoice ${invoice.amount_paise}`);
        return new Response(JSON.stringify({ error: 'Amount mismatch' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Validate currency matches invoice currency exactly
      const invoiceCurrency = (invoice.currency || 'INR').toUpperCase();
      if (currency !== invoiceCurrency) {
        console.error(`Currency mismatch: gateway ${currency} vs invoice ${invoiceCurrency}`);
        return new Response(JSON.stringify({ error: 'Currency mismatch' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Cross-invoice payment reuse check
      const { data: otherPayment } = await supabaseAdmin
        .from('payments')
        .select('id, invoice_id')
        .eq('gateway_payment_id', rzpPaymentId)
        .neq('invoice_id', invoice.id)
        .maybeSingle();

      if (otherPayment) {
        console.error(`Payment ID ${rzpPaymentId} is already linked to another invoice`);
        return new Response(JSON.stringify({
          error: 'Gateway payment ID is already bound to another invoice',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Atomic reconciliation via finalize_payment RPC (NO UNSAFE FALLBACK)
      const receiptNumber = `RCP-${invoice.invoice_number}-${Date.now().toString().slice(-4)}`;
      const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc('finalize_payment', {
        p_invoice_id: invoice.id,
        p_razorpay_order_id: rzpOrderId,
        p_razorpay_payment_id: rzpPaymentId,
        p_client_id: invoice.orders.client_id,
        p_amount_paise: amountPaise,
        p_currency: currency,
        p_receipt_number: receiptNumber,
        p_metadata: {
          verified_by: 'razorpay_webhook',
          event_id: eventDeliveryId,
          captured_at_ts: paymentEntity.created_at || null,
        },
      });

      if (rpcErr) {
        console.error('finalize_payment RPC error in webhook:', rpcErr);
        // Return 500 so Razorpay retries webhook delivery later
        // NEVER perform non-atomic direct write fallbacks!
        return new Response(JSON.stringify({
          error: 'Reconciliation transaction failed on database. Webhook will be retried.',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Insert in-app notification (isolated failure)
      await supabaseAdmin.from('notifications').insert({
        user_id: invoice.orders.client_id,
        type: 'payment_received',
        title: `Payment Received for Invoice ${invoice.invoice_number}`,
        body: `Payment of ${currency} ${(amountPaise / 100).toFixed(2)} was successfully captured. Receipt #${receiptNumber}.`,
        link: '/invoices/',
      }).catch((notifErr) => console.warn('Notification insert failed:', notifErr));

      return new Response(JSON.stringify({
        received: true,
        status: 'processed',
        payment_id: rpcResult.payment_id,
        receipt_number: rpcResult.receipt_number,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 6. Handle payment.failed Event
    if (event === 'payment.failed') {
      const paymentEntity = payload.payload?.payment?.entity;
      const rzpOrderId = paymentEntity?.order_id;

      if (rzpOrderId) {
        const { data: invoice } = await supabaseAdmin
          .from('invoices')
          .select('id, payment_attempts, invoice_number, orders!inner(client_id)')
          .eq('razorpay_order_id', rzpOrderId)
          .maybeSingle();

        if (invoice) {
          await supabaseAdmin
            .from('invoices')
            .update({ payment_attempts: (invoice.payment_attempts || 0) + 1 })
            .eq('id', invoice.id);

          await supabaseAdmin.from('audit_log').insert({
            actor_id: invoice.orders.client_id,
            action: 'payment_failed',
            target_table: 'invoices',
            target_id: invoice.id,
            details: {
              error_code: paymentEntity.error_code,
              error_description: paymentEntity.error_description,
              razorpay_order_id: rzpOrderId,
              gateway_payment_id: paymentEntity.id,
            },
          });
        }
      }

      return new Response(JSON.stringify({ received: true, status: 'failure_recorded' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 7. Acknowledge All Other Unhandled Events
    return new Response(JSON.stringify({ received: true, status: 'unhandled_event', event }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Unhandled webhook exception:', err);
    return new Response(JSON.stringify({ error: 'Internal server error processing webhook' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
