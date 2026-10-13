import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
 * Constant-time string equality to prevent timing attacks on HMAC signatures.
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Mandatory User Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Strict Service Configuration Check (Fail closed if ANY key is missing)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') ?? '';
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID') ?? '';

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: 'Database service configuration missing' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!razorpayKeySecret || !razorpayKeyId) {
      return new Response(JSON.stringify({
        error: 'Payment verification service is unconfigured. RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured.',
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Verify User Token
    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Validate Request Parameters
    const body = await req.json().catch(() => ({}));
    const invoiceId = body.invoice_id || body.invoiceId;
    const razorpay_order_id = (body.razorpay_order_id || '').trim();
    const razorpay_payment_id = (body.razorpay_payment_id || '').trim();
    const razorpay_signature = (body.razorpay_signature || '').trim();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !invoiceId) {
      return new Response(JSON.stringify({
        error: 'Missing required payment verification parameters (order_id, payment_id, signature, invoice_id)',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Privileged server-side client for authoritative DB operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Load Authoritative Invoice
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, status, amount_paise, currency, order_id, razorpay_order_id, orders!inner(client_id, id)')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: 'Authoritative invoice record not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Tenant Authorization Check: Caller must own linked order or be admin
    const isOwner = invoice.orders.client_id === user.id;
    if (!isOwner) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Forbidden: You do not have authorization to settle this invoice' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 7. Check if Invoice is Already Settled (Idempotency)
    if (invoice.status === 'Paid') {
      const { data: existingPayment } = await supabaseAdmin
        .from('payments')
        .select('id, receipt_number, gateway_payment_id')
        .eq('invoice_id', invoice.id)
        .eq('gateway_payment_id', razorpay_payment_id)
        .maybeSingle();

      if (existingPayment) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Invoice has already been settled under this payment reference',
          payment_id: existingPayment.id,
          receipt_number: existingPayment.receipt_number,
          invoiceId: invoice.id,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        error: 'Invoice is already marked as Paid under a different payment reference',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 8. Verify Stored Razorpay Order ID Match
    if (!invoice.razorpay_order_id || invoice.razorpay_order_id !== razorpay_order_id) {
      return new Response(JSON.stringify({
        error: 'Mismatched Razorpay order ID. Provided order ID does not match authoritative invoice record.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 9. Cryptographic HMAC-SHA256 Checkout Signature Verification
    const expectedSignature = await computeHmacSha256(
      razorpayKeySecret,
      `${razorpay_order_id}|${razorpay_payment_id}`
    );

    if (!timingSafeEqual(expectedSignature, razorpay_signature)) {
      return new Response(JSON.stringify({
        error: 'Cryptographic signature verification failed. Forged or corrupted payment payload.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 10. Authoritative Gateway API Verification (Mandatory Fail-Closed)
    // We strictly query Razorpay's server-side API to confirm payment status is 'captured'.
    let rzpPayData: any;
    try {
      const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
      const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: 'application/json',
        },
      });

      if (!rzpRes.ok) {
        console.error(`Razorpay API verification returned HTTP ${rzpRes.status} for payment ${razorpay_payment_id}`);
        return new Response(JSON.stringify({
          error: 'Gateway payment verification could not be confirmed. Gateway returned non-success response.',
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      rzpPayData = await rzpRes.json();
    } catch (fetchErr) {
      console.error('Razorpay API request failed or timed out:', fetchErr);
      return new Response(JSON.stringify({
        error: 'Gateway communication failure during payment verification. Please retry.',
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 11. Strict Gateway Payload Validation
    if (rzpPayData.order_id !== razorpay_order_id) {
      return new Response(JSON.stringify({ error: 'Gateway payment is bound to a different order ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (rzpPayData.amount !== invoice.amount_paise) {
      return new Response(JSON.stringify({
        error: `Captured payment amount (${rzpPayData.amount}) does not match authoritative invoice amount (${invoice.amount_paise})`,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const gatewayCurrency = (rzpPayData.currency || '').toUpperCase();
    const invoiceCurrency = (invoice.currency || 'INR').toUpperCase();
    if (gatewayCurrency !== invoiceCurrency) {
      return new Response(JSON.stringify({
        error: `Payment currency (${gatewayCurrency}) does not match invoice currency (${invoiceCurrency})`,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // STRICT STATUS: Must be 'captured'. Never accept 'authorized', 'created', or 'failed'.
    if (rzpPayData.status !== 'captured') {
      return new Response(JSON.stringify({
        error: `Payment is not captured. Gateway status: ${rzpPayData.status}. Only captured payments settle invoices.`,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 12. Check Cross-Invoice Payment Reuse in Database
    const { data: duplicatePayment } = await supabaseAdmin
      .from('payments')
      .select('id, invoice_id')
      .eq('gateway_payment_id', razorpay_payment_id)
      .neq('invoice_id', invoice.id)
      .maybeSingle();

    if (duplicatePayment) {
      return new Response(JSON.stringify({
        error: 'Gateway payment ID is already registered to a different invoice.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 13. Atomic Settlement via Secure finalize_payment RPC (No Fallback)
    const receiptNumber = `RCP-${invoice.invoice_number}-${Date.now().toString().slice(-4)}`;
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('finalize_payment', {
      p_invoice_id: invoice.id,
      p_razorpay_order_id: razorpay_order_id,
      p_razorpay_payment_id: razorpay_payment_id,
      p_client_id: invoice.orders.client_id,
      p_amount_paise: invoice.amount_paise,
      p_currency: invoice.currency || 'INR',
      p_receipt_number: receiptNumber,
      p_metadata: {
        verified_by: 'edge_function_verify',
        verified_user_id: user.id,
      },
    });

    if (rpcError) {
      console.error('finalize_payment RPC error in verify-razorpay-payment:', rpcError);
      // FAIL CLOSED: Never perform manual un-atomic fallback writes!
      return new Response(JSON.stringify({
        error: 'Payment reconciliation could not be finalized. Support has been notified.',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 14. Dispatch In-App Notification (Non-blocking)
    await supabaseAdmin.from('notifications').insert({
      user_id: invoice.orders.client_id,
      type: 'payment_received',
      title: `Payment Received for Invoice ${invoice.invoice_number}`,
      body: `Payment of ${invoice.currency || 'INR'} ${(invoice.amount_paise / 100).toFixed(2)} was successfully confirmed. Receipt #${receiptNumber}.`,
      link: '/invoices/',
    }).catch((notifErr) => console.warn('Notification dispatch non-fatal failure:', notifErr));

    // 15. Return Verified Authoritative Success Response
    return new Response(JSON.stringify({
      success: true,
      message: 'Payment verified and invoice settled successfully',
      payment_id: rpcResult.payment_id,
      receipt_number: rpcResult.receipt_number,
      invoiceId: invoice.id,
      orderId: invoice.order_id,
      remaining_order_balance_paise: rpcResult.remaining_order_balance_paise,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Unhandled exception in verify-razorpay-payment:', err);
    return new Response(JSON.stringify({
      error: 'An internal error occurred during payment verification.',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
