-- ============================================================================
-- Strova Group — Client Portal Schema & Row Level Security (RLS)
-- Target Host: portal.strovagroups.in
-- Database: Supabase PostgreSQL
-- ============================================================================

-- 1. Profiles Table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  division TEXT NOT NULL CHECK (division IN ('technologies', 'digital', 'commerce')),
  current_stage TEXT NOT NULL DEFAULT 'Brief received' CHECK (
    current_stage IN (
      'Brief received',
      'Scope agreed',
      'Advance received',
      'In progress',
      'Review',
      'Final payment',
      'Delivered',
      'Support'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Order Events / Timeline Table (8 stages)
CREATE TABLE IF NOT EXISTS public.order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (
    stage IN (
      'Brief received',
      'Scope agreed',
      'Advance received',
      'In progress',
      'Review',
      'Final payment',
      'Delivered',
      'Support'
    )
  ),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Deliverable Files Table (Private storage with 60-second signed links)
CREATE TABLE IF NOT EXISTS public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Invoices Table (Paid or Pending status, zero price lists)
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid')),
  pdf_storage_path TEXT NOT NULL,
  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Messages Table (Per order communication)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'admin')),
  message_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Audit Log Table (Internal administrative activity log)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- Helper Functions & Trigger
-- ============================================================================

-- Check if active authenticated user is an administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Auto-sync profile on auth user creation
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
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Row Level Security (RLS) Configuration
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Profiles Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can read their own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Orders Policies: Clients read only their own orders
-- ----------------------------------------------------------------------------
CREATE POLICY "Clients read their own orders"
  ON public.orders FOR SELECT
  USING (client_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins manage orders"
  ON public.orders FOR ALL
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Order Events Policies: Clients read events on their own orders
-- ----------------------------------------------------------------------------
CREATE POLICY "Clients read events on their own orders"
  ON public.order_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_events.order_id
        AND (orders.client_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Admins manage order events"
  ON public.order_events FOR ALL
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Deliverable Files Policies: Clients read files on their own orders
-- ----------------------------------------------------------------------------
CREATE POLICY "Clients read files for their own orders"
  ON public.files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = files.order_id
        AND (orders.client_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Admins manage files"
  ON public.files FOR ALL
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Invoices Policies: Clients read invoices for their own orders
-- ----------------------------------------------------------------------------
CREATE POLICY "Clients read invoices for their own orders"
  ON public.invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = invoices.order_id
        AND (orders.client_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Admins manage invoices"
  ON public.invoices FOR ALL
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Messages Policies: Clients read and insert messages on their own orders
-- ----------------------------------------------------------------------------
CREATE POLICY "Clients read messages on their own orders"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = messages.order_id
        AND (orders.client_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Clients insert messages on their own orders"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = messages.order_id
        AND orders.client_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage messages"
  ON public.messages FOR ALL
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Audit Log Policies: Admin only
-- ----------------------------------------------------------------------------
CREATE POLICY "Admins can view and create audit logs"
  ON public.audit_log FOR ALL
  USING (public.is_admin());

-- ============================================================================
-- Seed Data: 2 Test Clients & 1 Administrator
-- ============================================================================

-- Insert Test Profiles
INSERT INTO public.profiles (id, email, full_name, role)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'client-a@example.com', 'Client Alpha (Acme Health)', 'client'),
  ('22222222-2222-4222-8222-222222222222', 'client-b@example.com', 'Client Beta (Retail Brands)', 'client'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin@strovagroups.in', 'Strova Operations Admin', 'admin')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

-- Seed Orders
INSERT INTO public.orders (id, client_id, title, division, current_stage)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'Patient Scheduling Platform & WhatsApp Cloud API',
    'technologies',
    'In progress'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '22222222-2222-4222-8222-222222222222',
    'Technical SEO Architecture & Google Ads CAPI Wiring',
    'digital',
    'Review'
  )
ON CONFLICT (id) DO NOTHING;

-- Seed Order Events for Client A
INSERT INTO public.order_events (order_id, stage, note)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Brief received', 'Initial clinic scheduling requirements brief submitted via quote form.'),
  ('00000000-0000-0000-0000-000000000001', 'Scope agreed', 'Technical specification blueprint and sprint milestone schedule approved.'),
  ('00000000-0000-0000-0000-000000000001', 'Advance received', '50% initial milestone deposit received via bank transfer.'),
  ('00000000-0000-0000-0000-000000000001', 'In progress', 'Sprint 2 in progress: Meta WhatsApp Cloud API webhooks wired to booking queue.')
ON CONFLICT DO NOTHING;

-- Seed Order Events for Client B
INSERT INTO public.order_events (order_id, stage, note)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'Brief received', 'Inbound SEO audit inquiry received.'),
  ('00000000-0000-0000-0000-000000000002', 'Scope agreed', 'Technical SEO remediation and CAPI implementation agreement finalized.'),
  ('00000000-0000-0000-0000-000000000002', 'Advance received', 'Initial project advance confirmed.'),
  ('00000000-0000-0000-0000-000000000002', 'In progress', 'Core Web Vitals remediation completed on staging.'),
  ('00000000-0000-0000-0000-000000000002', 'Review', 'Staging deployment ready for client review and verification.')
ON CONFLICT DO NOTHING;

-- Seed Deliverable Files
INSERT INTO public.files (order_id, file_name, storage_path, file_size_bytes, mime_type)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'technical-architecture-blueprint-v1.pdf', 'client_1111/orders/0001/technical-architecture-blueprint-v1.pdf', 1245000, 'application/pdf'),
  ('00000000-0000-0000-0000-000000000002', 'seo-audit-remediation-report.pdf', 'client_2222/orders/0002/seo-audit-remediation-report.pdf', 2150000, 'application/pdf')
ON CONFLICT DO NOTHING;

-- Seed Invoices
INSERT INTO public.invoices (order_id, invoice_number, status, pdf_storage_path, paid_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'INV-2026-001', 'Paid', 'client_1111/invoices/INV-2026-001.pdf', timezone('utc'::text, now())),
  ('00000000-0000-0000-0000-000000000002', 'INV-2026-002', 'Pending', 'client_2222/invoices/INV-2026-002.pdf', NULL)
ON CONFLICT DO NOTHING;

