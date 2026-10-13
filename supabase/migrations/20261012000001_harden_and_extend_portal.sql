-- ============================================================================
-- Strova Group — Client Portal Schema Hardening & Extensions Migration
-- Target Host: portal.strovagroups.in
-- Database: Supabase PostgreSQL
-- ============================================================================

-- 1. HARDEN USER PROFILE CREATION TRIGGER
-- Absolute security rule: Never trust user-editable metadata (raw_user_meta_data)
-- for role assignment! All users created via auth must default strictly to 'client'.
-- Admin promotion can only happen via trusted database updates or admin scripts.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Attach trigger to auth.users for automated profile provisioning
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. EXTEND ORDERS TABLE WITH FINANCIAL AND SCOPE FIELDS
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS order_ref TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS scope_reference TEXT,
  ADD COLUMN IF NOT EXISTS target_completion_date DATE,
  ADD COLUMN IF NOT EXISTS total_amount_paise BIGINT DEFAULT 0 CHECK (total_amount_paise >= 0),
  ADD COLUMN IF NOT EXISTS balance_amount_paise BIGINT DEFAULT 0 CHECK (balance_amount_paise >= 0),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR' CHECK (currency IN ('INR', 'USD')),
  ADD COLUMN IF NOT EXISTS action_required_note TEXT;

-- 3. EXTEND INVOICES TABLE WITH FINANCIAL AMOUNT AND PAYMENT METADATA
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS amount_paise BIGINT NOT NULL DEFAULT 0 CHECK (amount_paise >= 0),
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR', 'USD')),
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_attempts INT DEFAULT 0;

-- 4. CREATE PAYMENTS TABLE (Immutable Transaction Records)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  gateway TEXT NOT NULL DEFAULT 'razorpay' CHECK (gateway IN ('razorpay', 'bank_transfer', 'test_sandbox')),
  gateway_order_id TEXT,
  gateway_payment_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'captured' CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded')),
  receipt_number TEXT UNIQUE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. CREATE SUPPORT TICKETS TABLE
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. CREATE SUPPORT RESPONSES TABLE
CREATE TABLE IF NOT EXISTS public.support_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'admin')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. ENABLE ROW LEVEL SECURITY ON NEW TABLES
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_responses ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES FOR PAYMENTS
-- Clients read payments belonging to their own client_id
CREATE POLICY "Clients read their own payments"
  ON public.payments FOR SELECT
  USING (client_id = auth.uid() OR public.is_admin());

-- Only admins / server-side service role can insert or manage payments
CREATE POLICY "Admins manage payments"
  ON public.payments FOR ALL
  USING (public.is_admin());

-- 9. RLS POLICIES FOR SUPPORT TICKETS
CREATE POLICY "Clients read their own tickets"
  ON public.support_tickets FOR SELECT
  USING (client_id = auth.uid() OR public.is_admin());

CREATE POLICY "Clients create their own tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Admins manage support tickets"
  ON public.support_tickets FOR ALL
  USING (public.is_admin());

-- 10. RLS POLICIES FOR SUPPORT RESPONSES
CREATE POLICY "Users read responses to their accessible tickets"
  ON public.support_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE support_tickets.id = support_responses.ticket_id
        AND (support_tickets.client_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Users insert responses to accessible tickets"
  ON public.support_responses FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE support_tickets.id = support_responses.ticket_id
        AND (support_tickets.client_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Admins manage support responses"
  ON public.support_responses FOR ALL
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 11. PROVISION PRIVATE STORAGE BUCKET FOR DELIVERABLES
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('deliverables', 'deliverables', false, false, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage RLS: Deliverables are strictly private.
-- Downloads require signed URLs or authenticated ownership check via public.files table.
DROP POLICY IF EXISTS "Admins have full access to deliverables" ON storage.objects;
CREATE POLICY "Admins have full access to deliverables"
  ON storage.objects FOR ALL
  USING (bucket_id = 'deliverables' AND public.is_admin());

DROP POLICY IF EXISTS "Clients read deliverables for their orders" ON storage.objects;
CREATE POLICY "Clients read deliverables for their orders"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'deliverables'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.files f
        JOIN public.orders o ON o.id = f.order_id
        WHERE f.storage_path = storage.objects.name
          AND o.client_id = auth.uid()
      )
    )
  );


