/**
 * Strova Group Client Hub — Production Supabase Browser Client
 * Domain: portal.strovagroups.in
 *
 * Provides real client-side authentication and database access via PostgREST.
 * Enforces PostgreSQL Row Level Security (RLS) using the authenticated user JWT.
 * Absolutely zero hard-coded fixtures or simulated sessions.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Environment variables exposed by Astro/Vite via PUBLIC_ prefix
export const SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PUBLIC_SUPABASE_URL) || '';
const SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PUBLIC_SUPABASE_ANON_KEY) || '';
export const TURNSTILE_SITE_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PUBLIC_TURNSTILE_SITE_KEY) || '';
export const isTurnstileConfigured = Boolean(TURNSTILE_SITE_KEY);
export const RAZORPAY_KEY_ID = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PUBLIC_RAZORPAY_KEY_ID) || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Import and re-export common domain types from pure type module
import type {
  UserProfile,
  ClientOrder,
  OrderEvent,
  ClientInvoice,
  ClientPayment,
  DeliverableFile,
  OrderMessage,
  SupportTicket,
  AuditLogEntry,
  PortalStage,
} from './portalTypes';
export type {
  UserProfile,
  ClientOrder,
  OrderEvent,
  ClientInvoice,
  ClientPayment,
  DeliverableFile,
  OrderMessage,
  SupportTicket,
  AuditLogEntry,
  PortalStage,
};
export { PORTAL_STAGES, getStageProgressPercent } from './portalTypes';

// Browser Supabase client instance (persists JWT tokens in browser storage)
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;


/**
 * Retrieves the currently authenticated Supabase session.
 */
export async function getSession() {
  if (!supabase) return null;
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) return null;
  return session;
}

/**
 * Retrieves the user profile matching the authenticated user.
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) return null;
  return data as UserProfile;
}

/**
 * Sends a genuine 6-digit one-time passcode to the client email.
 */
export async function signInWithOtp(email: string, captchaToken?: string) {
  if (!supabase) {
    throw new Error('Supabase authentication service is unconfigured.');
  }

  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false, // Strict invite-only: existing clients only
      captchaToken: captchaToken || undefined,
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Verifies the 6-digit OTP passcode submitted by the user.
 */
export async function verifyOtp(email: string, token: string) {
  if (!supabase) {
    throw new Error('Supabase authentication service is unconfigured.');
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) throw error;
  return data;
}

/**
 * Signs out and terminates the authenticated session.
 */
export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/**
 * Queries orders accessible to the current user (strictly constrained by RLS).
 */
export async function fetchMyOrders(): Promise<ClientOrder[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error.message);
    return [];
  }
  return (data || []) as ClientOrder[];
}

/**
 * Queries a single order by ID (RLS will return null if unauthorized).
 */
export async function fetchOrderById(orderId: string): Promise<ClientOrder | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error || !data) return null;
  return data as ClientOrder;
}

/**
 * Queries order timeline events.
 */
export async function fetchOrderEvents(orderId: string): Promise<OrderEvent[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('order_events')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data || []) as OrderEvent[];
}

/**
 * Queries invoices accessible to the user.
 */
export async function fetchMyInvoices(): Promise<ClientInvoice[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('invoices')
    .select('*, orders(title, order_ref)')
    .order('due_date', { ascending: false });

  if (error) return [];
  return (data || []) as ClientInvoice[];
}

/**
 * Queries verified payments and receipts.
 */
export async function fetchMyPayments(): Promise<ClientPayment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('payments')
    .select('*, invoices(invoice_number)')
    .order('captured_at', { ascending: false });

  if (error) return [];
  return (data || []) as ClientPayment[];
}

/**
 * Queries deliverables files accessible to the user.
 */
export async function fetchMyFiles(): Promise<DeliverableFile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('files')
    .select('*, orders(title, order_ref)')
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data || []) as DeliverableFile[];
}

/**
 * Generates an ephemeral signed download URL for private deliverables.
 */
export async function createDownloadSignedUrl(storagePath: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from('deliverables')
    .createSignedUrl(storagePath, 60);

  if (error || !data?.signedUrl) {
    console.error('Storage signed URL error:', error?.message);
    return null;
  }
  return data.signedUrl;
}

/**
 * Queries messages for a specific order.
 */
export async function fetchOrderMessages(orderId: string): Promise<OrderMessage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data || []) as OrderMessage[];
}

/**
 * Sends a message within an order thread.
 */
export async function sendOrderMessage(orderId: string, messageText: string, role: 'client' | 'admin' = 'client') {
  if (!supabase) throw new Error('Supabase client unconfigured.');
  const session = await getSession();
  if (!session) throw new Error('Authentication required.');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      order_id: orderId,
      sender_id: session.user.id,
      sender_role: role,
      message_text: messageText.trim(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Queries support tickets.
 */
export async function fetchSupportTickets(): Promise<SupportTicket[]> {
  if (!supabase) throw new Error('Support service is not configured.');
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as SupportTicket[];
}

/**
 * Creates a new support ticket.
 */
export async function createSupportTicket(ticket: {
  subject: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  order_id?: string;
}) {
  if (!supabase) throw new Error('Supabase client unconfigured.');
  const session = await getSession();
  if (!session) throw new Error('Authentication required.');

  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      client_id: session.user.id,
      order_id: ticket.order_id || null,
      subject: ticket.subject.trim(),
      description: ticket.description.trim(),
      priority: ticket.priority,
      status: 'open',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetches unread notifications for the authenticated user.
 */
export async function fetchNotifications(limit = 20): Promise<any[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}

/**
 * Fetches the count of unread notifications.
 */
export async function fetchUnreadNotificationCount(): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false);

  if (error) return 0;
  return count || 0;
}

/**
 * Marks a notification as read.
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
}

/**
 * Marks all notifications as read.
 */
export async function markAllNotificationsRead(): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false);
}

// -----------------------------------------------------------------------------
// Administrator Functions (Enforced by PostgreSQL RLS on the server)
// -----------------------------------------------------------------------------
export async function fetchAdminClients(): Promise<UserProfile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data || []) as UserProfile[];
}

export async function fetchAdminOrders(): Promise<ClientOrder[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data || []) as ClientOrder[];
}

export async function fetchAdminInvoices(): Promise<ClientInvoice[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('invoices')
    .select('*, orders(title, order_ref)')
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data || []) as ClientInvoice[];
}

export async function fetchAdminAuditLogs(): Promise<AuditLogEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return [];
  return (data || []) as AuditLogEntry[];
}

