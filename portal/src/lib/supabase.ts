/**
 * Strova Group Client Portal — Supabase Client & Data Layer
 * Host: portal.strovagroups.in
 *
 * Implements:
 * - Supabase Auth (6-digit email OTP, shouldCreateUser: false for invite-only)
 * - Row Level Security (RLS) enforcement
 * - Ephemeral signed download links for private deliverables
 * - Razorpay order creation and signature verification
 * - Turnstile server-side challenge verification
 * - Sandbox fallback for isolated CI and local developer preview
 */

import { createClient } from '@supabase/supabase-js';

// In browser context (Vite/Astro), import.meta.env is used. In Node context, process.env is checked.
const getEnv = (key: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] || '';
  }
  return '';
};

export const SUPABASE_URL = getEnv('PUBLIC_SUPABASE_URL') || getEnv('SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnv('PUBLIC_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY');
export const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

export const TURNSTILE_SITE_KEY = getEnv('PUBLIC_TURNSTILE_SITE_KEY') || '1x00000000000000000000AA'; // Cloudflare test always-pass sitekey by default
export const RAZORPAY_KEY_ID = getEnv('PUBLIC_RAZORPAY_KEY_ID') || 'rzp_test_placeholder';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Browser / Anon Supabase instance (respects RLS, authenticates with cookies/localStorage)
export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// Server-side Service Role Supabase instance (admin only - never expose to browser)
export const supabaseAdmin = (isSupabaseConfigured && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

// -----------------------------------------------------------------------------
// Portal Stages & Explicit Rules
// -----------------------------------------------------------------------------
export const PORTAL_STAGES = [
  'Brief received',
  'Scope agreed',
  'Advance pending',
  'In progress',
  'Review',
  'Revisions',
  'Final payment pending',
  'Delivered',
  'Support',
] as const;

export type PortalStage = typeof PORTAL_STAGES[number];

/** Explicit progress calculation rules based on defined milestones */
export function getStageProgressPercent(stage: PortalStage): number {
  switch (stage) {
    case 'Brief received': return 10;
    case 'Scope agreed': return 25;
    case 'Advance pending': return 35;
    case 'In progress': return 50;
    case 'Review': return 75;
    case 'Revisions': return 85;
    case 'Final payment pending': return 90;
    case 'Delivered': return 100;
    case 'Support': return 100;
    default: return 0;
  }
}

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------
export interface PortalProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'client' | 'admin';
  created_at: string;
}

export interface PortalOrder {
  id: string;
  order_ref: string;
  client_id: string;
  title: string;
  division: 'technologies' | 'digital' | 'commerce';
  current_stage: PortalStage;
  scope_reference?: string;
  target_completion_date?: string;
  total_amount_paise: number;
  balance_amount_paise: number;
  currency: 'INR' | 'USD';
  action_required_note?: string;
  created_at: string;
  updated_at: string;
}

export interface PortalOrderEvent {
  id: string;
  order_id: string;
  stage: PortalStage;
  note: string;
  created_at: string;
}

export interface PortalFile {
  id: string;
  order_id: string;
  file_name: string;
  storage_path: string;
  file_size_bytes: number;
  mime_type: string;
  created_at: string;
}

export interface PortalInvoice {
  id: string;
  order_id: string;
  invoice_number: string;
  status: 'Pending' | 'Paid';
  amount_paise: number;
  currency: 'INR' | 'USD';
  due_date: string;
  pdf_storage_path: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  issued_at: string;
  paid_at: string | null;
  created_at: string;
}

export interface PortalPayment {
  id: string;
  invoice_id: string;
  order_id: string;
  client_id: string;
  amount_paise: number;
  currency: string;
  gateway: 'razorpay' | 'bank_transfer';
  gateway_order_id?: string;
  gateway_payment_id: string;
  status: 'captured' | 'failed' | 'refunded';
  receipt_number: string;
  captured_at: string;
}

export interface PortalMessage {
  id: string;
  order_id: string;
  sender_id: string;
  sender_role: 'client' | 'admin';
  message_text: string;
  created_at: string;
}

export interface PortalSupportTicket {
  id: string;
  client_id: string;
  order_id?: string;
  subject: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface PortalAuditLog {
  id: string;
  actor_id: string;
  action: string;
  target_table: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

// Re-export client utilities and types from supabaseClient
export * from './supabaseClient';

// End of client module
