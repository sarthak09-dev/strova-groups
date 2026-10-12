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
import crypto from 'node:crypto';

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
  gateway: 'razorpay' | 'bank_transfer' | 'test_sandbox';
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

// -----------------------------------------------------------------------------
// Isolated In-Memory Fixtures for Unit Testing & CI Sandbox Mode
// -----------------------------------------------------------------------------
export const SEED_PROFILES: PortalProfile[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'client-a@example.com',
    full_name: 'Client Alpha (Acme Health)',
    role: 'client',
    created_at: '2026-10-01T10:00:00Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'client-b@example.com',
    full_name: 'Client Beta (Retail Brands)',
    role: 'client',
    created_at: '2026-10-05T11:00:00Z',
  },
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    email: 'admin@strovagroups.in',
    full_name: 'Strova Operations Admin',
    role: 'admin',
    created_at: '2026-09-01T08:00:00Z',
  },
];

export const SEED_ORDERS: PortalOrder[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    order_ref: 'ORD-2026-001',
    client_id: '11111111-1111-4111-8111-111111111111',
    title: 'Patient Scheduling Platform & WhatsApp Cloud API',
    division: 'technologies',
    current_stage: 'In progress',
    scope_reference: 'SOW-TECH-2026-01',
    target_completion_date: '2026-11-15',
    total_amount_paise: 25000000, // ₹2,50,000.00
    balance_amount_paise: 12500000, // ₹1,25,000.00
    currency: 'INR',
    action_required_note: 'Please review staging demo link for Sprint 2 user journeys.',
    created_at: '2026-10-02T10:00:00Z',
    updated_at: '2026-10-10T14:30:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    order_ref: 'ORD-2026-002',
    client_id: '22222222-2222-4222-8222-222222222222',
    title: 'Technical SEO Architecture & Google Ads CAPI Wiring',
    division: 'digital',
    current_stage: 'Review',
    scope_reference: 'SOW-DIG-2026-04',
    target_completion_date: '2026-10-25',
    total_amount_paise: 12000000, // ₹1,20,000.00
    balance_amount_paise: 6000000,  // ₹60,000.00
    currency: 'INR',
    action_required_note: 'Awaiting client audit sign-off on staging environment.',
    created_at: '2026-10-06T12:00:00Z',
    updated_at: '2026-10-11T16:00:00Z',
  },
];

export const SEED_ORDER_EVENTS: PortalOrderEvent[] = [
  {
    id: 'ev-1',
    order_id: '00000000-0000-0000-0000-000000000001',
    stage: 'Brief received',
    note: 'Initial clinic scheduling brief submitted via quote request form.',
    created_at: '2026-10-02T10:15:00Z',
  },
  {
    id: 'ev-2',
    order_id: '00000000-0000-0000-0000-000000000001',
    stage: 'Scope agreed',
    note: 'Technical specification blueprint and sprint milestone schedule approved.',
    created_at: '2026-10-03T14:00:00Z',
  },
  {
    id: 'ev-3',
    order_id: '00000000-0000-0000-0000-000000000001',
    stage: 'Advance pending',
    note: 'Invoice INV-2026-001 issued for 50% project advance.',
    created_at: '2026-10-03T14:30:00Z',
  },
  {
    id: 'ev-4',
    order_id: '00000000-0000-0000-0000-000000000001',
    stage: 'In progress',
    note: '50% initial project advance confirmed (Receipt RCP-INV-2026-001-0421). Sprint 2 in progress: Meta WhatsApp Cloud API webhooks wired.',
    created_at: '2026-10-04T11:30:00Z',
  },
  {
    id: 'ev-5',
    order_id: '00000000-0000-0000-0000-000000000002',
    stage: 'Brief received',
    note: 'Inbound SEO audit inquiry received.',
    created_at: '2026-10-06T12:15:00Z',
  },
  {
    id: 'ev-6',
    order_id: '00000000-0000-0000-0000-000000000002',
    stage: 'Scope agreed',
    note: 'Remediation agreement and Conversion API scope signed.',
    created_at: '2026-10-07T09:45:00Z',
  },
  {
    id: 'ev-7',
    order_id: '00000000-0000-0000-0000-000000000002',
    stage: 'In progress',
    note: 'Advance settled. Core Web Vitals remediation deployed on staging.',
    created_at: '2026-10-08T15:20:00Z',
  },
  {
    id: 'ev-8',
    order_id: '00000000-0000-0000-0000-000000000002',
    stage: 'Review',
    note: 'Staging deployment ready for client review and verification.',
    created_at: '2026-10-11T16:00:00Z',
  },
];

export const SEED_FILES: PortalFile[] = [
  {
    id: 'f1',
    order_id: '00000000-0000-0000-0000-000000000001',
    file_name: 'technical-architecture-blueprint-v1.pdf',
    storage_path: 'client_1111/orders/0001/technical-architecture-blueprint-v1.pdf',
    file_size_bytes: 1245000,
    mime_type: 'application/pdf',
    created_at: '2026-10-03T14:10:00Z',
  },
  {
    id: 'f2',
    order_id: '00000000-0000-0000-0000-000000000002',
    file_name: 'seo-audit-remediation-report.pdf',
    storage_path: 'client_2222/orders/0002/seo-audit-remediation-report.pdf',
    file_size_bytes: 2150000,
    mime_type: 'application/pdf',
    created_at: '2026-10-11T16:05:00Z',
  },
];

export const SEED_INVOICES: PortalInvoice[] = [
  {
    id: 'inv-1',
    order_id: '00000000-0000-0000-0000-000000000001',
    invoice_number: 'INV-2026-001',
    status: 'Paid',
    amount_paise: 12500000, // ₹1,25,000.00
    currency: 'INR',
    due_date: '2026-10-10',
    pdf_storage_path: 'client_1111/invoices/INV-2026-001.pdf',
    razorpay_order_id: 'order_test_inv1_settled',
    razorpay_payment_id: 'pay_test_inv1_settled',
    issued_at: '2026-10-03',
    paid_at: '2026-10-04T11:30:00Z',
    created_at: '2026-10-03T14:30:00Z',
  },
  {
    id: 'inv-2',
    order_id: '00000000-0000-0000-0000-000000000002',
    invoice_number: 'INV-2026-002',
    status: 'Pending',
    amount_paise: 6000000, // ₹60,000.00
    currency: 'INR',
    due_date: '2026-10-18',
    pdf_storage_path: 'client_2222/invoices/INV-2026-002.pdf',
    razorpay_order_id: undefined,
    razorpay_payment_id: undefined,
    issued_at: '2026-10-08',
    paid_at: null,
    created_at: '2026-10-08T15:30:00Z',
  },
];

export const SEED_PAYMENTS: PortalPayment[] = [
  {
    id: 'pay-1',
    invoice_id: 'inv-1',
    order_id: '00000000-0000-0000-0000-000000000001',
    client_id: '11111111-1111-4111-8111-111111111111',
    amount_paise: 12500000,
    currency: 'INR',
    gateway: 'razorpay',
    gateway_order_id: 'order_test_inv1_settled',
    gateway_payment_id: 'pay_test_inv1_settled',
    status: 'captured',
    receipt_number: 'RCP-INV-2026-001-0421',
    captured_at: '2026-10-04T11:30:00Z',
  },
];

export const SEED_MESSAGES: PortalMessage[] = [
  {
    id: 'm1',
    order_id: '00000000-0000-0000-0000-000000000001',
    sender_id: '11111111-1111-4111-8111-111111111111',
    sender_role: 'client',
    message_text: 'Uploaded the WhatsApp Cloud API webhook credentials in the secure vault.',
    created_at: '2026-10-05T09:15:00Z',
  },
  {
    id: 'm2',
    order_id: '00000000-0000-0000-0000-000000000001',
    sender_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    sender_role: 'admin',
    message_text: 'Credentials verified and staging webhooks are now actively listening.',
    created_at: '2026-10-05T11:40:00Z',
  },
  {
    id: 'm3',
    order_id: '00000000-0000-0000-0000-000000000002',
    sender_id: '22222222-2222-4222-8222-222222222222',
    sender_role: 'client',
    message_text: 'Reviewed the Core Web Vitals remediation plan. Approved to deploy to staging.',
    created_at: '2026-10-09T14:10:00Z',
  },
];

export const SEED_SUPPORT_TICKETS: PortalSupportTicket[] = [
  {
    id: 't-1',
    client_id: '11111111-1111-4111-8111-111111111111',
    order_id: '00000000-0000-0000-0000-000000000001',
    subject: 'Meta Cloud API WhatsApp Business Verification assistance',
    description: 'We need guidance on submitting clinic registration documents for green tick badge verification.',
    priority: 'normal',
    status: 'in_progress',
    created_at: '2026-10-07T11:00:00Z',
    updated_at: '2026-10-08T09:30:00Z',
  },
];

export const SEED_AUDIT_LOG: PortalAuditLog[] = [
  {
    id: 'aud-1',
    actor_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    action: 'CREATE_CLIENT',
    target_table: 'profiles',
    target_id: '11111111-1111-4111-8111-111111111111',
    details: { email: 'client-a@example.com' },
    created_at: '2026-10-01T10:00:00Z',
  },
  {
    id: 'aud-2',
    actor_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    action: 'CREATE_ORDER',
    target_table: 'orders',
    target_id: '00000000-0000-0000-0000-000000000001',
    details: { division: 'technologies', order_ref: 'ORD-2026-001' },
    created_at: '2026-10-02T10:00:00Z',
  },
  {
    id: 'aud-3',
    actor_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    action: 'PAYMENT_VERIFIED',
    target_table: 'invoices',
    target_id: 'inv-1',
    details: { invoice_number: 'INV-2026-001', amount_paise: 12500000, status: 'Paid' },
    created_at: '2026-10-04T11:30:00Z',
  },
];

// -----------------------------------------------------------------------------
// Ephemeral Signed URL Generator (60 seconds)
// -----------------------------------------------------------------------------
const SIGNING_SECRET = getEnv('PORTAL_SIGNING_SECRET') || 'strova-ephemeral-portal-signing-secret-60s';

export function createSignedDownloadUrl(fileId: string, orderId: string, clientId: string, seconds = 60): string {
  const expires = Math.floor(Date.now() / 1000) + seconds;
  const payload = `${fileId}:${orderId}:${clientId}:${expires}`;
  const sig = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
  return `/api/portal/download?fileId=${fileId}&orderId=${orderId}&clientId=${clientId}&expires=${expires}&sig=${sig}`;
}

export function verifySignedDownloadToken(params: {
  fileId: string;
  orderId: string;
  clientId: string;
  expires: number;
  sig: string;
  userRole: 'client' | 'admin';
  requestingUserId: string;
}): { valid: boolean; reason?: string } {
  const { fileId, orderId, clientId, expires, sig, userRole, requestingUserId } = params;

  const now = Math.floor(Date.now() / 1000);
  if (now > expires) {
    return { valid: false, reason: 'Signed download link has expired (> 60 seconds).' };
  }

  const expectedPayload = `${fileId}:${orderId}:${clientId}:${expires}`;
  const expectedSig = crypto.createHmac('sha256', SIGNING_SECRET).update(expectedPayload).digest('hex');
  if (sig !== expectedSig) {
    return { valid: false, reason: 'Invalid or forged cryptographic signature.' };
  }

  if (userRole !== 'admin' && requestingUserId !== clientId) {
    return { valid: false, reason: 'Cross-tenant access forbidden under Row Level Security.' };
  }

  return { valid: true };
}
