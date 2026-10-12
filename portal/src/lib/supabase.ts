/**
 * Strova Group Client Portal — Supabase Client & Data Layer
 * Host: portal.strovagroups.in
 *
 * Implements:
 * - Supabase Auth (6-digit email OTP, shouldCreateUser: false)
 * - Row Level Security (RLS) enforcement
 * - 60-second ephemeral signed download links for private deliverables
 * - Local deterministic sandbox mode for CI/development when live credentials are not set
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Client-side / Anon Supabase instance (respects RLS)
export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// Server-side Admin Supabase instance (Service Role - never expose to browser)
export const supabaseAdmin = (isSupabaseConfigured && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

// -----------------------------------------------------------------------------
// Seed Data Fixtures (matches supabase/migrations/20261012000000_client_portal_schema.sql)
// -----------------------------------------------------------------------------
export const PORTAL_STAGES = [
  'Brief received',
  'Scope agreed',
  'Advance received',
  'In progress',
  'Review',
  'Final payment',
  'Delivered',
  'Support',
] as const;

export type PortalStage = typeof PORTAL_STAGES[number];

export interface PortalProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'client' | 'admin';
  created_at: string;
}

export interface PortalOrder {
  id: string;
  client_id: string;
  title: string;
  division: 'technologies' | 'digital' | 'commerce';
  current_stage: PortalStage;
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
  pdf_storage_path: string;
  issued_at: string;
  paid_at: string | null;
  created_at: string;
}

export interface PortalMessage {
  id: string;
  order_id: string;
  sender_id: string;
  sender_role: 'client' | 'admin';
  message_text: string;
  created_at: string;
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
// In-Memory Seed Store (used when testing or running sandbox mode)
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
    client_id: '11111111-1111-4111-8111-111111111111',
    title: 'Patient Scheduling Platform & WhatsApp Cloud API',
    division: 'technologies',
    current_stage: 'In progress',
    created_at: '2026-10-02T10:00:00Z',
    updated_at: '2026-10-10T14:30:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    client_id: '22222222-2222-4222-8222-222222222222',
    title: 'Technical SEO Architecture & Google Ads CAPI Wiring',
    division: 'digital',
    current_stage: 'Review',
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
    stage: 'Advance received',
    note: '50% initial project milestone advance confirmed via direct RTGS transfer.',
    created_at: '2026-10-04T11:30:00Z',
  },
  {
    id: 'ev-4',
    order_id: '00000000-0000-0000-0000-000000000001',
    stage: 'In progress',
    note: 'Sprint 2 in progress: Meta WhatsApp Cloud API webhooks wired to booking queue.',
    created_at: '2026-10-10T14:30:00Z',
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
    stage: 'Advance received',
    note: 'Project advance confirmed.',
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
    pdf_storage_path: 'client_1111/invoices/INV-2026-001.pdf',
    issued_at: '2026-10-03',
    paid_at: '2026-10-04T11:30:00Z',
    created_at: '2026-10-03T14:30:00Z',
  },
  {
    id: 'inv-2',
    order_id: '00000000-0000-0000-0000-000000000002',
    invoice_number: 'INV-2026-002',
    status: 'Pending',
    pdf_storage_path: 'client_2222/invoices/INV-2026-002.pdf',
    issued_at: '2026-10-08',
    paid_at: null,
    created_at: '2026-10-08T15:30:00Z',
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
    details: { division: 'technologies' },
    created_at: '2026-10-02T10:00:00Z',
  },
];

// -----------------------------------------------------------------------------
// 60-Second Ephemeral Signed URL Generator
// -----------------------------------------------------------------------------
const SIGNING_SECRET = process.env.PORTAL_SIGNING_SECRET || 'strova-ephemeral-portal-signing-secret-60s';

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
    return { valid: false, reason: 'Invalid or forged signature.' };
  }

  if (userRole !== 'admin' && requestingUserId !== clientId) {
    return { valid: false, reason: 'Cross-tenant access forbidden under Row Level Security.' };
  }

  return { valid: true };
}

