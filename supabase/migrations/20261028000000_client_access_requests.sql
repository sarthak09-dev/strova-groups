-- Public client-hub requests remain pending until an administrator reviews them.
-- This table is deliberately unavailable to anon/authenticated browser clients.
CREATE TABLE IF NOT EXISTS public.client_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 120),
  email TEXT NOT NULL CHECK (char_length(email) <= 254),
  company_name TEXT CHECK (company_name IS NULL OR char_length(company_name) <= 160),
  request_context TEXT NOT NULL CHECK (char_length(btrim(request_context)) BETWEEN 10 AND 1500),
  privacy_notice_accepted_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT CHECK (admin_notes IS NULL OR char_length(admin_notes) <= 2000),
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_access_requests_email_format CHECK (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

CREATE UNIQUE INDEX IF NOT EXISTS client_access_requests_one_pending_per_email
  ON public.client_access_requests (lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS client_access_requests_status_submitted_idx
  ON public.client_access_requests (status, submitted_at DESC);

ALTER TABLE public.client_access_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.client_access_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.client_access_requests TO service_role;

COMMENT ON TABLE public.client_access_requests IS
  'Private client access applications. Requests do not create Supabase Auth users; service-role functions manage review and approval.';
