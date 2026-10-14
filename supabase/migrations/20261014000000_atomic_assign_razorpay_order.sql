-- ============================================================================
-- Strova Group — Atomic Razorpay Order Assignment & Concurrency Guard Migration
-- Migration: 20261014000000_atomic_assign_razorpay_order.sql
-- Database: Supabase PostgreSQL
-- ============================================================================
-- 1. Creates public.assign_invoice_razorpay_order() RPC:
--    - Uses explicit row locking (SELECT ... FOR UPDATE) on invoices
--    - Verifies invoice ownership matches client_id
--    - Verifies invoice status is strictly 'Pending'
--    - Idempotently allows re-assignment of the identical order_id
--    - Prevents concurrent requests from overwriting an already assigned order
--    - Returns JSONB result with success flag, assigned order ID, and error code
-- 2. Explicitly revokes execution from PUBLIC, anon, and authenticated
-- 3. Grants execute ONLY to service_role (Edge Functions)
-- 4. Enforces immutable search_path = public, pg_temp
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_invoice_razorpay_order(
  p_invoice_id UUID,
  p_client_id UUID,
  p_razorpay_order_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice RECORD;
BEGIN
  -- 1. Input Validation
  IF p_invoice_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_INVOICE_ID', 'message', 'Invoice ID is required');
  END IF;

  IF p_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CLIENT_ID', 'message', 'Client ID is required');
  END IF;

  IF p_razorpay_order_id IS NULL OR length(trim(p_razorpay_order_id)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_ORDER_ID', 'message', 'Razorpay order ID cannot be empty');
  END IF;

  -- 2. Lock the invoice row for update and check ownership
  SELECT i.id, i.status, i.razorpay_order_id, i.amount_paise, i.currency, o.client_id
  INTO v_invoice
  FROM public.invoices i
  JOIN public.orders o ON o.id = i.order_id
  WHERE i.id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVOICE_NOT_FOUND', 'message', 'Invoice not found');
  END IF;

  -- 3. Ownership Verification
  IF v_invoice.client_id != p_client_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED_CLIENT', 'message', 'Client does not own this invoice');
  END IF;

  -- 4. Status Verification
  IF v_invoice.status != 'Pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVOICE_NOT_PENDING',
      'status', v_invoice.status,
      'assigned_order_id', v_invoice.razorpay_order_id,
      'message', 'Invoice is no longer pending payment'
    );
  END IF;

  -- 5. Concurrency Guard: Check if another concurrent request already assigned a different gateway order
  IF v_invoice.razorpay_order_id IS NOT NULL AND v_invoice.razorpay_order_id != p_razorpay_order_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ORDER_ALREADY_ASSIGNED',
      'assigned_order_id', v_invoice.razorpay_order_id,
      'message', 'A gateway order has already been assigned to this invoice by another request'
    );
  END IF;

  -- 6. Perform the atomic update and increment payment attempts
  UPDATE public.invoices
  SET razorpay_order_id = p_razorpay_order_id,
      payment_attempts = COALESCE(payment_attempts, 0) + 1
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'assigned_order_id', p_razorpay_order_id,
    'status', 'Pending',
    'message', 'Gateway order assigned successfully'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Privilege Restrictions: Revoke from untrusted callers, grant ONLY to service_role
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.assign_invoice_razorpay_order(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_invoice_razorpay_order(UUID, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.assign_invoice_razorpay_order(UUID, UUID, TEXT) IS
  'Atomically assigns a Razorpay gateway order to a pending invoice with row locking and race-condition prevention. Accessible ONLY by service_role.';

