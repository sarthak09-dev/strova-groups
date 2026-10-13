import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3';
import { hmac } from 'https://deno.land/x/hmac@v2.0.1/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Database service configuration missing' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const invoiceId = body.invoice_id || body.invoiceId;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !invoiceId) {
      return new Response(JSON.stringify({ error: 'Missing required payment verification parameters (order_id, payment_id, signature, invoice_id)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fail closed: Never verify payments if gateway secrets are missing
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    if (!razorpayKeySecret) {
      return new Response(JSON.stringify({
        error: 'Payment verification service is unconfigured. RAZORPAY_KEY_SECRET must be configured in environment secrets.',
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch authoritative invoice record
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, status, amount_paise, currency, order_id, razorpay_order_id, orders!inner(client_id, id)')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice record not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authoritative Tenant Ownership Check:
    // Only the invoice owner or an administrator can verify payments
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

    // Check if invoice is already settled
    if (invoice.status === 'Paid') {
      return new Response(JSON.stringify({
        success: true,
        message: 'Invoice has already been verified and paid.',
        invoiceId: invoice.id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify stored Razorpay Order ID matches exactly
    if (!invoice.razorpay_order_id || invoice.razorpay_order_id !== razorpay_order_id) {
      return new Response(JSON.stringify({
        error: 'Mismatched Razorpay order ID. Provided order does not match authoritative invoice order record.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cryptographic HMAC-SHA256 signature verification
    const expectedSignature = hmac('sha256', razorpayKeySecret, `${razorpay_order_id}|${razorpay_payment_id}`, 'utf8', 'hex');
    if (expectedSignature !== razorpay_signature) {
      return new Response(JSON.stringify({ error: 'Cryptographic signature verification failed. Forged or corrupted payment payload.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Direct gateway API verification for defense-in-depth
    if (razorpayKeyId) {
      try {
        const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
        const rzpPayRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
          headers: { 'Authorization': `Basic ${auth}` },
        });

        if (rzpPayRes.ok) {
          const rzpPayData = await rzpPayRes.json();
          if (rzpPayData.order_id !== razorpay_order_id) {
            return new Response(JSON.stringify({ error: 'Gateway payment is bound to a different order' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          if (rzpPayData.amount !== invoice.amount_paise) {
            return new Response(JSON.stringify({ error: 'Captured payment amount does not match invoice amount' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          if (rzpPayData.status !== 'captured' && rzpPayData.status !== 'authorized') {
            return new Response(JSON.stringify({ error: `Payment not completed. Gateway status: ${rzpPayData.status}` }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } catch (gwErr) {
        console.warn('Razorpay API verification warning (HMAC signature already passed):', gwErr);
      }
    }

    // Idempotency check: Ensure payment is not recorded twice
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id, receipt_number')
      .eq('gateway_payment_id', razorpay_payment_id)
      .maybeSingle();

    if (existingPayment) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Payment already recorded idempotently',
        payment_id: existingPayment.id,
        receipt_number: existingPayment.receipt_number,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Record immutable payment entry
    const receiptNumber = `RCP-${invoice.invoice_number}-${Date.now().toString().slice(-4)}`;
    const { data: newPayment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        invoice_id: invoice.id,
        order_id: invoice.order_id,
        client_id: invoice.orders.client_id,
        amount_paise: invoice.amount_paise,
        currency: invoice.currency || 'INR',
        gateway: 'razorpay',
        gateway_order_id: razorpay_order_id,
        gateway_payment_id: razorpay_payment_id,
        status: 'captured',
        receipt_number: receiptNumber,
        metadata: {
          verified_by: 'edge_function_verify',
          verified_user_id: user.id,
        },
      })
      .select()
      .single();

    if (paymentError) {
      return new Response(JSON.stringify({ error: 'Failed to record payment in ledger', details: paymentError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark invoice as Paid
    await supabaseAdmin
      .from('invoices')
      .update({
        status: 'Paid',
        paid_at: new Date().toISOString(),
        razorpay_payment_id: razorpay_payment_id,
      })
      .eq('id', invoice.id);

    // Reconcile order balance
    const { data: remainingInvoices } = await supabaseAdmin
      .from('invoices')
      .select('amount_paise')
      .eq('order_id', invoice.order_id)
      .eq('status', 'Pending');

    const newBalance = (remainingInvoices || []).reduce((sum, inv) => sum + (inv.amount_paise || 0), 0);
    await supabaseAdmin
      .from('orders')
      .update({ balance_amount_paise: newBalance })
      .eq('id', invoice.order_id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Payment verified and invoice marked Paid.',
      payment_id: newPayment.id,
      receipt_number: receiptNumber,
      invoice_id: invoice.id,
      // CamelCase aliases
      paymentId: newPayment.id,
      receiptNumber: receiptNumber,
      invoiceId: invoice.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
