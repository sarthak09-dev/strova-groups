import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3';

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

    // Fail closed if database credentials are not configured
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Database service configuration missing' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user token
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

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: 'invoice_id parameter is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service role client to query authoritative database state
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch authoritative invoice and check ownership against authenticated user
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, status, amount_paise, currency, order_id, razorpay_order_id, orders!inner(client_id, title)')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authoritative Tenant Verification:
    // Only the order's client or an admin can create a payment order
    const isOwner = invoice.orders.client_id === user.id;
    if (!isOwner) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Forbidden: You do not own this invoice' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Invoice Status Verification: Only Pending invoices can be checked out
    if (invoice.status === 'Paid') {
      return new Response(JSON.stringify({ error: 'Invoice is already settled' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (invoice.status !== 'Pending') {
      return new Response(JSON.stringify({ error: `Invoice is in ${invoice.status} status and cannot be checked out` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authoritative Amount and Currency Verification (Never trust browser-supplied prices)
    if (!invoice.amount_paise || typeof invoice.amount_paise !== 'number' || invoice.amount_paise <= 0) {
      return new Response(JSON.stringify({ error: 'Invoice has zero or invalid balance amount' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currency = (invoice.currency || 'INR').toUpperCase().trim();

    // Browser supplied price mismatch check (tamper resistance)
    const clientSuppliedAmount = body.amount_paise || body.amount;
    if (clientSuppliedAmount && clientSuppliedAmount !== invoice.amount_paise) {
      return new Response(JSON.stringify({ error: 'Price tampering detected: amount does not match authoritative invoice balance' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    // Strict fail-closed: Never generate fake orders if gateway keys are missing
    if (!razorpayKeyId || !razorpayKeySecret) {
      return new Response(JSON.stringify({
        error: 'Payment gateway is unconfigured. RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured in environment secrets.',
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    // Idempotent Order Reuse:
    // If the invoice already has a valid razorpay_order_id, check if it's still open and valid at the gateway
    if (invoice.razorpay_order_id) {
      try {
        const existingOrderRes = await fetch(`https://api.razorpay.com/v1/orders/${invoice.razorpay_order_id}`, {
          method: 'GET',
          headers: { 'Authorization': `Basic ${auth}` },
        });

        if (existingOrderRes.ok) {
          const existingOrder = await existingOrderRes.json();
          // If existing gateway order matches amount and currency and is still created/attempted, reuse it!
          if (
            existingOrder.id === invoice.razorpay_order_id &&
            existingOrder.amount === invoice.amount_paise &&
            existingOrder.currency === currency &&
            (existingOrder.status === 'created' || existingOrder.status === 'attempted')
          ) {
            return new Response(JSON.stringify({
              key_id: razorpayKeyId,
              order_id: existingOrder.id,
              amount_paise: invoice.amount_paise,
              currency,
              invoice_number: invoice.invoice_number,
              reused: true,
              keyId: razorpayKeyId,
              orderId: existingOrder.id,
              amount: invoice.amount_paise,
              invoiceNumber: invoice.invoice_number,
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } catch {
        // Fall through to create a new order if gateway fetch fails
      }
    }

    // Call Razorpay API to create order
    const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: invoice.amount_paise,
        currency,
        receipt: invoice.invoice_number,
        notes: {
          invoice_id: invoice.id,
          client_id: invoice.orders.client_id,
          order_id: invoice.order_id,
        },
      }),
    });

    const rzpOrder = await rzpResponse.json();
    if (!rzpResponse.ok || !rzpOrder || !rzpOrder.id) {
      // Do not leak sensitive provider internal errors
      const safeErrorMsg = rzpOrder?.error?.description || 'Razorpay order creation rejected by gateway';
      return new Response(JSON.stringify({ error: safeErrorMsg }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate gateway order response matches requested amount and currency
    if (rzpOrder.amount !== invoice.amount_paise || rzpOrder.currency !== currency) {
      return new Response(JSON.stringify({ error: 'Gateway returned mismatched order amount or currency' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Persist razorpay_order_id on invoice AND verify database write succeeded
    const { error: updateError } = await supabaseAdmin
      .from('invoices')
      .update({ razorpay_order_id: rzpOrder.id })
      .eq('id', invoice.id)
      .eq('status', 'Pending'); // optimistic concurrency check

    if (updateError) {
      // Recovery & Auditing: Record orphan gateway order in audit_log
      await supabaseAdmin.from('audit_log').insert({
        actor_id: user.id,
        action: 'gateway_order_orphaned',
        target_table: 'invoices',
        target_id: invoice.id,
        details: {
          error: updateError.message,
          gateway_order_id: rzpOrder.id,
          amount_paise: invoice.amount_paise,
        },
      });

      // FAIL CLOSED: Never report success if database persistence failed!
      return new Response(JSON.stringify({
        error: 'Failed to record gateway order on invoice. Payment cannot proceed.',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Standardized contract with snake_case and camelCase aliases for interoperability
    return new Response(JSON.stringify({
      key_id: razorpayKeyId,
      order_id: rzpOrder.id,
      amount_paise: invoice.amount_paise,
      currency,
      invoice_number: invoice.invoice_number,
      keyId: razorpayKeyId,
      orderId: rzpOrder.id,
      amount: invoice.amount_paise,
      invoiceNumber: invoice.invoice_number,
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
