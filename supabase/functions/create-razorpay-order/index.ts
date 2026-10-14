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

    /**
     * Authoritatively validates a Razorpay order at the gateway.
     */
    async function fetchAndValidateGatewayOrder(
      orderId: string,
      basicAuth: string,
      expectedAmount: number,
      expectedCurrency: string
    ): Promise<
      | { kind: 'valid'; order: any }
      | { kind: 'paid'; order: any }
      | { kind: 'invalid_or_stale'; status: string; reason: string }
      | { kind: 'not_found' }
      | { kind: 'gateway_error'; status: number; message: string }
      | { kind: 'network_timeout'; message: string }
    > {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.status === 404) {
          return { kind: 'not_found' };
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          return {
            kind: 'gateway_error',
            status: res.status,
            message: `Gateway returned HTTP ${res.status}: ${errText.slice(0, 200)}`,
          };
        }

        const order = await res.json();
        if (!order || !order.id) {
          return { kind: 'invalid_or_stale', status: 'unknown', reason: 'Malformed order payload' };
        }

        if (order.status === 'paid') {
          return { kind: 'paid', order };
        }

        const matchesAmount = order.amount === expectedAmount;
        const matchesCurrency = (order.currency || '').toUpperCase() === expectedCurrency.toUpperCase();
        const isOpen = order.status === 'created' || order.status === 'attempted';

        if (matchesAmount && matchesCurrency && isOpen) {
          return { kind: 'valid', order };
        }

        return {
          kind: 'invalid_or_stale',
          status: order.status || 'unknown',
          reason: `Order mismatch: status=${order.status}, amount=${order.amount} (expected ${expectedAmount}), currency=${order.currency} (expected ${expectedCurrency})`,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { kind: 'network_timeout', message: 'Gateway request timed out while validating order' };
        }
        return { kind: 'network_timeout', message: err.message || 'Network error while contacting gateway' };
      }
    }

    // Idempotent Order Reuse & Staleness Verification:
    let expectedPreviousOrderId: string | null = null;

    if (invoice.razorpay_order_id) {
      const existingCheck = await fetchAndValidateGatewayOrder(
        invoice.razorpay_order_id,
        auth,
        invoice.amount_paise,
        currency
      );

      if (existingCheck.kind === 'valid') {
        // Reuse valid open order idempotently
        return new Response(JSON.stringify({
          key_id: razorpayKeyId,
          order_id: existingCheck.order.id,
          amount_paise: invoice.amount_paise,
          currency,
          invoice_number: invoice.invoice_number,
          reused: true,
          keyId: razorpayKeyId,
          orderId: existingCheck.order.id,
          amount: invoice.amount_paise,
          invoiceNumber: invoice.invoice_number,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (existingCheck.kind === 'paid') {
        // Gateway reports order is already paid! Never create replacement order.
        return new Response(JSON.stringify({
          error: 'This invoice has already been settled at the payment gateway. Payment reconciliation in progress.',
          status: 'paid',
          order_id: invoice.razorpay_order_id,
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (existingCheck.kind === 'gateway_error' || existingCheck.kind === 'network_timeout') {
        // Fail safely on network errors/timeouts/5xx: do NOT assume order is dead, do NOT create duplicate
        const httpStatus = existingCheck.kind === 'network_timeout' ? 504 : 502;
        return new Response(JSON.stringify({
          error: 'Payment gateway reachability error while checking existing order. Please retry.',
          detail: existingCheck.message,
        }), {
          status: httpStatus,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Order is dead, cancelled, expired, or 404: record expected previous ID for atomic CAS replacement
      expectedPreviousOrderId = invoice.razorpay_order_id;
    }

    // Call Razorpay API to create new order with timeout guard
    let rzpOrder: any;
    try {
      const createController = new AbortController();
      const createTimeoutId = setTimeout(() => createController.abort(), 8000);

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
        signal: createController.signal,
      });
      clearTimeout(createTimeoutId);

      rzpOrder = await rzpResponse.json();
      if (!rzpResponse.ok || !rzpOrder || !rzpOrder.id) {
        const safeErrorMsg = rzpOrder?.error?.description || 'Razorpay order creation rejected by gateway';
        return new Response(JSON.stringify({ error: safeErrorMsg }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (createErr: any) {
      const isTimeout = createErr.name === 'AbortError';
      return new Response(JSON.stringify({
        error: isTimeout
          ? 'Gateway timeout while creating Razorpay order. Please retry.'
          : 'Network error while contacting Razorpay gateway',
      }), {
        status: isTimeout ? 504 : 502,
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

    // Persist razorpay_order_id on invoice atomically AND verify database write succeeded
    let finalOrderId = rzpOrder.id;
    let assignmentSucceeded = false;

    // 1. Attempt atomic RPC assignment with row-level locking (SELECT ... FOR UPDATE) and CAS
    const { data: assignResult, error: rpcError } = await supabaseAdmin
      .rpc('assign_invoice_razorpay_order', {
        p_invoice_id: invoice.id,
        p_client_id: invoice.orders.client_id,
        p_razorpay_order_id: rzpOrder.id,
        p_expected_previous_order_id: expectedPreviousOrderId,
      });

    if (!rpcError && assignResult) {
      const assignment = typeof assignResult === 'string' ? JSON.parse(assignResult) : assignResult;
      if (assignment.success) {
        finalOrderId = assignment.assigned_order_id;
        assignmentSucceeded = true;
      } else if (assignment.error_code === 'ORDER_ALREADY_ASSIGNED') {
        // Concurrency race: another simultaneous request assigned/modified an order
        const winnerOrderId = assignment.assigned_order_id;

        // Log our redundant gateway order as orphaned for audit reconciliation
        await supabaseAdmin.from('audit_log').insert({
          actor_id: user.id,
          action: 'gateway_order_orphaned',
          target_table: 'invoices',
          target_id: invoice.id,
          details: {
            reason: 'concurrency_race',
            orphaned_gateway_order_id: rzpOrder.id,
            winning_order_id: winnerOrderId,
            amount_paise: invoice.amount_paise,
          },
        });

        // The loser MUST verify the winner's gateway order before giving it to the browser
        if (winnerOrderId) {
          const winnerValidation = await fetchAndValidateGatewayOrder(
            winnerOrderId,
            auth,
            invoice.amount_paise,
            currency
          );

          if (winnerValidation.kind === 'valid') {
            finalOrderId = winnerOrderId;
            assignmentSucceeded = true;
          } else if (winnerValidation.kind === 'paid') {
            return new Response(JSON.stringify({
              error: 'This invoice has already been settled at the payment gateway.',
              status: 'paid',
              order_id: winnerOrderId,
            }), {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } else {
            return new Response(JSON.stringify({
              error: 'Concurrent gateway order verification failed',
              detail: winnerValidation.kind === 'gateway_error' ? winnerValidation.message : 'Invalid winning order state',
            }), {
              status: 502,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } else if (assignment.error_code === 'INVOICE_NOT_PENDING') {
        // Invoice was settled or cancelled concurrently
        await supabaseAdmin.from('audit_log').insert({
          actor_id: user.id,
          action: 'gateway_order_orphaned',
          target_table: 'invoices',
          target_id: invoice.id,
          details: {
            reason: 'invoice_no_longer_pending',
            orphaned_gateway_order_id: rzpOrder.id,
            invoice_status: assignment.status,
            amount_paise: invoice.amount_paise,
          },
        });

        return new Response(JSON.stringify({
          error: 'Invoice is no longer pending payment.',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // 2. Direct PostgREST atomic conditional update fallback with row count verification
      let updateQuery = supabaseAdmin
        .from('invoices')
        .update({
          razorpay_order_id: rzpOrder.id,
          payment_attempts: (invoice.payment_attempts || 0) + 1,
        })
        .eq('id', invoice.id)
        .eq('status', 'Pending');

      if (expectedPreviousOrderId) {
        updateQuery = updateQuery.eq('razorpay_order_id', expectedPreviousOrderId);
      } else {
        updateQuery = updateQuery.or(`razorpay_order_id.is.null,razorpay_order_id.eq.${rzpOrder.id}`);
      }

      const { data: updatedRows, error: updateError } = await updateQuery.select('id, razorpay_order_id, status');

      if (!updateError && updatedRows && updatedRows.length === 1) {
        finalOrderId = updatedRows[0].razorpay_order_id;
        assignmentSucceeded = true;
      } else {
        // Row was not updated. Check if another concurrent request already assigned an order
        const { data: freshInvoice } = await supabaseAdmin
          .from('invoices')
          .select('id, status, razorpay_order_id')
          .eq('id', invoice.id)
          .single();

        if (freshInvoice && freshInvoice.status === 'Pending' && freshInvoice.razorpay_order_id) {
          const winnerOrderId = freshInvoice.razorpay_order_id;

          await supabaseAdmin.from('audit_log').insert({
            actor_id: user.id,
            action: 'gateway_order_orphaned',
            target_table: 'invoices',
            target_id: invoice.id,
            details: {
              reason: 'concurrency_race',
              orphaned_gateway_order_id: rzpOrder.id,
              winning_order_id: winnerOrderId,
              amount_paise: invoice.amount_paise,
            },
          });

          // Validate winner's order at gateway
          const winnerValidation = await fetchAndValidateGatewayOrder(
            winnerOrderId,
            auth,
            invoice.amount_paise,
            currency
          );

          if (winnerValidation.kind === 'valid') {
            finalOrderId = winnerOrderId;
            assignmentSucceeded = true;
          } else if (winnerValidation.kind === 'paid') {
            return new Response(JSON.stringify({
              error: 'This invoice has already been settled at the payment gateway.',
              status: 'paid',
              order_id: winnerOrderId,
            }), {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      }
    }

    if (!assignmentSucceeded) {
      // Neither update nor concurrent winner verified: fail closed
      await supabaseAdmin.from('audit_log').insert({
        actor_id: user.id,
        action: 'gateway_order_orphaned',
        target_table: 'invoices',
        target_id: invoice.id,
        details: {
          error: rpcError?.message || 'Database update matched zero rows',
          orphaned_gateway_order_id: rzpOrder.id,
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
      order_id: finalOrderId,
      amount_paise: invoice.amount_paise,
      currency,
      invoice_number: invoice.invoice_number,
      keyId: razorpayKeyId,
      orderId: finalOrderId,
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
