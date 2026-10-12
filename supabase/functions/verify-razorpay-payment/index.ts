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

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      invoiceId,
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !invoiceId) {
      return new Response(JSON.stringify({ error: 'Missing payment verification parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the invoice
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, status, amount_paise, currency, order_id, razorpay_order_id, orders!inner(client_id)')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice record not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify order ID matches what was stored on the server
    if (invoice.razorpay_order_id && invoice.razorpay_order_id !== razorpay_order_id) {
      return new Response(JSON.stringify({ error: 'Mismatched Razorpay order ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    // Cryptographic signature check
    if (razorpayKeySecret) {
      if (!razorpay_signature) {
        return new Response(JSON.stringify({ error: 'Signature required when gateway is configured' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const generatedSignature = hmac('sha256', razorpayKeySecret, `${razorpay_order_id}|${razorpay_payment_id}`, 'utf8', 'hex');
      if (generatedSignature !== razorpay_signature) {
        return new Response(JSON.stringify({ error: 'Invalid payment signature. Verification failed.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // In sandbox mode without keys, ensure payment ID starts with test prefix
      if (!razorpay_payment_id.startsWith('pay_test_')) {
        return new Response(JSON.stringify({ error: 'Test mode requires pay_test_ prefix' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Idempotency check: Ensure payment is not recorded twice
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('gateway_payment_id', razorpay_payment_id)
      .maybeSingle();

    if (existingPayment) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Payment already processed and reconciled',
        paymentId: existingPayment.id,
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
        currency: invoice.currency,
        gateway: razorpayKeySecret ? 'razorpay' : 'test_sandbox',
        gateway_order_id: razorpay_order_id,
        gateway_payment_id: razorpay_payment_id,
        status: 'captured',
        receipt_number: receiptNumber,
        metadata: { verified_by: 'edge_function_verify' },
      })
      .select()
      .single();

    if (paymentError) {
      return new Response(JSON.stringify({ error: 'Failed to record payment', details: paymentError }), {
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
        razorpay_payment_id,
      })
      .eq('id', invoice.id);

    // Update order balance
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('balance_amount_paise')
      .eq('id', invoice.order_id)
      .single();

    if (order) {
      const newBalance = Math.max(0, (order.balance_amount_paise || 0) - invoice.amount_paise);
      await supabaseAdmin
        .from('orders')
        .update({ balance_amount_paise: newBalance })
        .eq('id', invoice.order_id);
    }

    // Record audit event
    await supabaseAdmin
      .from('audit_log')
      .insert({
        actor_id: user.id,
        action: 'PAYMENT_VERIFIED_AND_INVOICE_PAID',
        target_table: 'invoices',
        target_id: invoice.id,
        details: {
          invoice_number: invoice.invoice_number,
          amount_paise: invoice.amount_paise,
          gateway_payment_id: razorpay_payment_id,
          receipt_number: receiptNumber,
        },
      });

    return new Response(JSON.stringify({
      success: true,
      receiptNumber,
      invoiceNumber: invoice.invoice_number,
      amountPaise: invoice.amount_paise,
      status: 'Paid',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

