-- ============================================================================
-- Strova Group — Realtime Publications & In-App Notifications Migration
-- Migration: 20261013000002_realtime_and_notifications.sql
-- Database: Supabase PostgreSQL
-- ============================================================================
-- 1. Creates notifications table with strict RLS
-- 2. Creates notification indexes for performance
-- 3. Enables Supabase Realtime on messages, notifications, support_responses, order_events
-- ============================================================================

-- 1. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'order_update',
    'invoice_issued',
    'payment_received',
    'message_received',
    'file_uploaded',
    'support_update',
    'system'
  )),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance indexes for notifications queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON public.notifications(user_id, is_read, created_at DESC);

-- 2. ENABLE RLS ON NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Clients can only read their own notifications
CREATE POLICY "Users read their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- Clients can mark their own notifications as read
CREATE POLICY "Users update their own notifications read status"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Only admins / server-side service role can insert notifications
CREATE POLICY "Admins insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins manage notifications"
  ON public.notifications FOR ALL
  USING (public.is_admin());

-- 3. ENABLE SUPABASE REALTIME REPLICATION
-- Supabase uses the supabase_realtime publication to stream table changes
DO $$
BEGIN
  -- Add messages table to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  -- Add notifications table to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  -- Add support_responses table to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'support_responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_responses;
  END IF;

  -- Add order_events table to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'order_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_events;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- In environments without pre-existing supabase_realtime publication,
    -- create publication or log gracefully
    RAISE NOTICE 'supabase_realtime publication not found or not configurable in this environment';
END;
$$;
