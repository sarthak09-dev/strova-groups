-- ============================================================================
-- Strova Group — Atomic Payment Reconciliation RPC Function
-- Migration: 20261013000000_atomic_payment_rpc.sql
-- Database: Supabase PostgreSQL
-- ============================================================================
-- Provides a strictly atomic, transactional RPC to settle invoices and record
-- payments. Prevents partial state, race conditions, and double-crediting.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.finalize_payment(
  p_invoice_id UUID,
  p_razorpay_order_id TEXT,
  p_razorpay_payment_id TEXT,
  p_client_id UUID,
  p_amount_paise BIGINT,
  p_currency TEXT DEFAULT 'INR',
  p_receipt_number TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice RECORD;
  v_payment RECORD;
  v_new_balance BIGINT;
  v_receipt TEXT;
BEGIN
  -- 1. Lock invoice row with FOR UPDATE to prevent concurrent payment race conditions
  SELECT id, invoice_number, status, amount_paise, currency, order_id, razorpay_order_id
  INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', p_invoice_id USING ERRCODE = 'P0002';
  END IF;

  -- 2. Idempotency check: If invoice is already paid, check if this payment was already recorded
  IF v_invoice.status = 'Paid' THEN
    SELECT id, receipt_number, status, gateway_payment_id
    INTO v_payment
    FROM public.payments
    WHERE gateway_payment_id = p_razorpay_payment_id;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Payment already processed idempotently',
        'payment_id', v_payment.id,
        'receipt_number', v_payment.receipt_number,
        'invoice_id', v_invoice.id,
        'already_settled', true
      );
    ELSE
      RAISE EXCEPTION 'Invoice % is already Paid under a different payment reference', p_invoice_id USING ERRCODE = '23505';
    END IF;
  END IF;

  -- 3. Validate razorpay_order_id match (if invoice has one stored)
  IF v_invoice.razorpay_order_id IS NOT NULL AND v_invoice.razorpay_order_id <> p_razorpay_order_id THEN
    RAISE EXCEPTION 'Razorpay order ID mismatch: expected %, got %', v_invoice.razorpay_order_id, p_razorpay_order_id USING ERRCODE = '22000';
  END IF;

  -- 4. Validate amount matches invoice exact amount
  IF v_invoice.amount_paise <> p_amount_paise THEN
    RAISE EXCEPTION 'Payment amount mismatch: invoice amount is %, payment amount is %', v_invoice.amount_paise, p_amount_paise USING ERRCODE = '22000';
  END IF;

  -- 5. Validate client owns the associated order
  IF NOT EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = v_invoice.order_id AND client_id = p_client_id
  ) THEN
    RAISE EXCEPTION 'Client % does not own order % for invoice %', p_client_id, v_invoice.order_id, p_invoice_id USING ERRCODE = '42501';
  END IF;

  -- 6. Generate receipt number if not provided
  v_receipt := COALESCE(
    p_receipt_number,
    'RCP-' || v_invoice.invoice_number || '-' || TO_CHAR(clock_timestamp(), 'MSUS')
  );

  -- 7. Insert immutable payment record
  INSERT INTO public.payments (
    invoice_id,
    order_id,
    client_id,
    amount_paise,
    currency,
    gateway,
    gateway_order_id,
    gateway_payment_id,
    status,
    receipt_number,
    captured_at,
    metadata
  ) VALUES (
    v_invoice.id,
    v_invoice.order_id,
    p_client_id,
    p_amount_paise,
    COALESCE(p_currency, v_invoice.currency, 'INR'),
    'razorpay',
    p_razorpay_order_id,
    p_razorpay_payment_id,
    'captured',
    v_receipt,
    timezone('utc'::text, now()),
    p_metadata
  )
  RETURNING * INTO v_payment;

  -- 8. Update invoice status to 'Paid'
  UPDATE public.invoices
  SET 
    status = 'Paid',
    paid_at = timezone('utc'::text, now()),
    razorpay_payment_id = p_razorpay_payment_id
  WHERE id = v_invoice.id;

  -- 9. Reconcile order balance atomically
  SELECT COALESCE(SUM(amount_paise), 0)
  INTO v_new_balance
  FROM public.invoices
  WHERE order_id = v_invoice.order_id
    AND status = 'Pending';

  UPDATE public.orders
  SET 
    balance_amount_paise = v_new_balance,
    updated_at = timezone('utc'::text, now())
  WHERE id = v_invoice.order_id;

  -- 10. Record immutable audit log entry
  INSERT INTO public.audit_log (
    actor_id,
    action,
    target_table,
    target_id,
    details
  ) VALUES (
    p_client_id,
    'payment_finalized',
    'invoices',
    v_invoice.id::TEXT,
    jsonb_build_object(
      'amount_paise', p_amount_paise,
      'currency', COALESCE(p_currency, 'INR'),
      'gateway_payment_id', p_razorpay_payment_id,
      'gateway_order_id', p_razorpay_order_id,
      'receipt_number', v_receipt,
      'order_id', v_invoice.order_id,
      'remaining_balance_paise', v_new_balance
    )
  );

  -- 11. Return authoritative result
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Payment atomically finalized and reconciled',
    'payment_id', v_payment.id,
    'receipt_number', v_receipt,
    'invoice_id', v_invoice.id,
    'order_id', v_invoice.order_id,
    'remaining_order_balance_paise', v_new_balance
  );
END;
$$;
