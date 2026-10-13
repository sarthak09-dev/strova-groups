-- ============================================================================
-- Strova Group — Support Ticket RLS Hardening Migration
-- Migration: 20261013000001_fix_support_ticket_rls.sql
-- Database: Supabase PostgreSQL
-- ============================================================================
-- Enforces that clients can only associate support tickets with orders they
-- actually own (order_id IS NULL OR client owns the referenced order).
-- Prevents cross-client order reference enumeration and spoofing.
-- ============================================================================

DROP POLICY IF EXISTS "Clients create their own tickets" ON public.support_tickets;

CREATE POLICY "Clients create their own tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (
    client_id = auth.uid()
    AND (
      order_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = support_tickets.order_id
          AND orders.client_id = auth.uid()
      )
    )
  );
