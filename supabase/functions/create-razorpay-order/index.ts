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

    // Verify user JWT with Anon client
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

    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: 'invoiceId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service role client to query authoritative database state
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch invoice and check ownership against authenticated user
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, status, amount_paise, currency, order_id, orders!inner(client_id, title)')
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
      // Check if user is admin
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

    if (invoice.status === 'Paid') {
      return new Response(JSON.stringify({ error: 'Invoice is already settled' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    // If Razorpay live/test credentials are configured, create real Razorpay Order
    if (razorpayKeyId && razorpayKeySecret) {
      const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
      const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: invoice.amount_paise,
          currency: invoice.currency || 'INR',
          receipt: invoice.invoice_number,
          notes: {
            invoice_id: invoice.id,
            client_id: invoice.orders.client_id,
            order_id: invoice.order_id,
          },
        }),
      });

      const rzpOrder = await rzpResponse.json();
      if (!rzpResponse.ok) {
        return new Response(JSON.stringify({ error: 'Razorpay order creation failed', details: rzpOrder }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update invoice with razorpay_order_id
      await supabaseAdmin
        .from('invoices')
        .update({ razorpay_order_id: rzpOrder.id })
        .eq('id', invoice.id);

      return new Response(JSON.stringify({
        keyId: razorpayKeyId,
        orderId: rzpOrder.id,
        amount: invoice.amount_paise,
        currency: invoice.currency || 'INR',
        invoiceNumber: invoice.invoice_number,
        isTestMode: razorpayKeyId.startsWith('rzp_test_'),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Test mode / gateway setup pending mode
      const mockOrderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      await supabaseAdmin
        .from('invoices')
        .update({ razorpay_order_id: mockOrderId })
        .eq('id', invoice.id);

      return new Response(JSON.stringify({
        keyId: 'rzp_test_placeholder_unconfigured',
        orderId: mockOrderId,
        amount: invoice.amount_paise,
        currency: invoice.currency || 'INR',
        invoiceNumber: invoice.invoice_number,
        isTestMode: true,
        notice: 'Razorpay test mode active (credentials pending in environment). Real money will not be charged.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

