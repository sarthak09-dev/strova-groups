-- ============================================================================
-- Strova Group — Secure Payment Finalization RPC & Privilege Hardening Migration
-- Migration: 20261013000003_secure_finalize_payment_rpc.sql
-- Database: Supabase PostgreSQL
-- ============================================================================
-- 1. Hardens public.finalize_payment() RPC with comprehensive validation:
--    - Exact currency match (no silent default)
--    - Non-empty parameter checks
--    - Cross-invoice payment ID reuse prevention
--    - Idempotency bound to both invoice_id and gateway_payment_id
--    - Explicit row-level locking (SELECT ... FOR UPDATE)
--    - Immediate atomic order balance recalculation
-- 2. Explicitly revokes execution privileges from PUBLIC, anon, and authenticated
-- 3. Grants execute ONLY to service_role (invoked exclusively by server-side Edge Functions)
-- 4. Ensures search_path hygiene on SECURITY DEFINER triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION public.finalize_payment(
  p_invoice_id UUID,
  p_razorpay_order_id TEXT,
  p_razorpay_payment_id TEXT,
  p_client_id UUID,
  p_amount_paise BIGINT,
  p_currency TEXT,
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
  v_existing_other_payment RECORD;
  v_new_balance BIGINT;
  v_receipt TEXT;
BEGIN
  -- 1. Strict Parameter Pre-Validation
  IF p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'Invoice ID is required' USING ERRCODE = '22004';
  END IF;

  IF p_razorpay_order_id IS NULL OR length(trim(p_razorpay_order_id)) = 0 THEN
    RAISE EXCEPTION 'Razorpay order ID cannot be empty' USING ERRCODE = '22004';
  END IF;

  IF p_razorpay_payment_id IS NULL OR length(trim(p_razorpay_payment_id)) = 0 THEN
    RAISE EXCEPTION 'Razorpay payment ID cannot be empty' USING ERRCODE = '22004';
  END IF;

  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'Client ID is required' USING ERRCODE = '22004';
  END IF;

  IF p_amount_paise IS NULL OR p_amount_paise <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be a positive integer in paise' USING ERRCODE = '22003';
  END IF;

  IF p_currency IS NULL OR length(trim(p_currency)) = 0 THEN
    RAISE EXCEPTION 'Payment currency is required' USING ERRCODE = '22004';
  END IF;

  -- 2. Lock invoice row with FOR UPDATE to prevent concurrent double-settlement races
  SELECT id, invoice_number, status, amount_paise, currency, order_id, razorpay_order_id
  INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', p_invoice_id USING ERRCODE = 'P0002';
  END IF;

  -- 3. Cross-Invoice Payment ID Reuse Guard
  -- Prevent an attacker from reusing a valid payment ID from another invoice
  SELECT id, invoice_number, gateway_payment_id
  INTO v_existing_other_payment
  FROM public.payments
  WHERE gateway_payment_id = trim(p_razorpay_payment_id)
    AND invoice_id <> p_invoice_id
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Gateway payment ID % is already bound to another invoice (%)', 
      p_razorpay_payment_id, v_existing_other_payment.invoice_number USING ERRCODE = '23505';
  END IF;

  -- 4. Idempotency Check
  -- If invoice is already 'Paid', only return success if this exact gateway payment was recorded for this exact invoice
  IF v_invoice.status = 'Paid' THEN
    SELECT id, receipt_number, status, gateway_payment_id
    INTO v_payment
    FROM public.payments
    WHERE gateway_payment_id = trim(p_razorpay_payment_id)
      AND invoice_id = p_invoice_id;

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

  -- 5. Status Check: Only 'Pending' invoices can be settled
  IF v_invoice.status <> 'Pending' THEN
    RAISE EXCEPTION 'Invoice % is in status % and cannot be settled', v_invoice.invoice_number, v_invoice.status USING ERRCODE = '22000';
  END IF;

  -- 6. Validate Razorpay Order ID Match
  IF v_invoice.razorpay_order_id IS NULL OR v_invoice.razorpay_order_id <> trim(p_razorpay_order_id) THEN
    RAISE EXCEPTION 'Razorpay order ID mismatch: expected %, got %', 
      v_invoice.razorpay_order_id, p_razorpay_order_id USING ERRCODE = '22000';
  END IF;

  -- 7. Strict Currency Validation (No defaulting)
  IF upper(trim(v_invoice.currency)) <> upper(trim(p_currency)) THEN
    RAISE EXCEPTION 'Currency mismatch: invoice currency is %, payment currency is %', 
      v_invoice.currency, p_currency USING ERRCODE = '22000';
  END IF;

  -- 8. Exact Amount Validation
  IF v_invoice.amount_paise <> p_amount_paise THEN
    RAISE EXCEPTION 'Payment amount mismatch: invoice amount is %, payment amount is %', 
      v_invoice.amount_paise, p_amount_paise USING ERRCODE = '22000';
  END IF;

  -- 9. Client Ownership of Linked Order Check
  IF NOT EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = v_invoice.order_id AND client_id = p_client_id
  ) THEN
    RAISE EXCEPTION 'Client % does not own order % for invoice %', 
      p_client_id, v_invoice.order_id, p_invoice_id USING ERRCODE = '42501';
  END IF;

  -- 10. Generate Receipt Number
  v_receipt := COALESCE(
    trim(p_receipt_number),
    'RCP-' || v_invoice.invoice_number || '-' || TO_CHAR(clock_timestamp(), 'MSUS')
  );

  -- 11. Insert Immutable Payment Record
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
    upper(trim(v_invoice.currency)),
    'razorpay',
    trim(p_razorpay_order_id),
    trim(p_razorpay_payment_id),
    'captured',
    v_receipt,
    timezone('utc'::text, now()),
    p_metadata
  )
  RETURNING * INTO v_payment;

  -- 12. Update Invoice to 'Paid'
  UPDATE public.invoices
  SET 
    status = 'Paid',
    paid_at = timezone('utc'::text, now()),
    razorpay_payment_id = trim(p_razorpay_payment_id)
  WHERE id = v_invoice.id;

  -- 13. Reconcile Order Balance Atomically
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

  -- 14. Record Immutable Audit Log
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
      'currency', upper(trim(v_invoice.currency)),
      'gateway_payment_id', trim(p_razorpay_payment_id),
      'gateway_order_id', trim(p_razorpay_order_id),
      'receipt_number', v_receipt,
      'order_id', v_invoice.order_id,
      'remaining_balance_paise', v_new_balance
    )
  );

  -- 15. Return Authoritative Result
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

-- ============================================================================
-- PRIVILEGE RESTRICTION: CRITICAL SECURITY CONTROL
-- ============================================================================
-- Revoke execution from PUBLIC (all users), anon (unauthenticated), and authenticated (logged-in clients).
-- This function settles invoices and manipulates financial ledgers; it must NEVER be directly
-- callable by browser clients via the PostgREST /rpc/finalize_payment endpoint.

REVOKE ALL ON FUNCTION public.finalize_payment(
  uuid, text, text, uuid, bigint, text, text, jsonb
) FROM PUBLIC, anon, authenticated;

-- Grant EXECUTE exclusively to service_role (the privileged server-side role used by Edge Functions)
GRANT EXECUTE ON FUNCTION public.finalize_payment(
  uuid, text, text, uuid, bigint, text, text, jsonb
) TO service_role;

-- ============================================================================
-- SEARCH PATH HYGIENE ON AUTH TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'client' -- STRICT DEFAULT: Never trust raw_user_meta_data for 'admin' privilege!
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- SEARCH PATH HYGIENE ON RLS HELPER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;


