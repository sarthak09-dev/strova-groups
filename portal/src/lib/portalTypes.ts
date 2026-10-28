/**
 * Strova Group Client Portal — Shared Types & Stage Constants
 */

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

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'client' | 'admin';
  created_at: string;
}

export interface ClientOrder {
  id: string;
  order_ref: string;
  client_id: string;
  title: string;
  division: 'technologies' | 'digital' | 'commerce' | 'automation' | 'products';
  current_stage: PortalStage | string;
  scope_reference?: string;
  target_completion_date?: string;
  total_amount_paise: number;
  balance_amount_paise: number;
  currency: 'INR' | 'USD';
  action_required_note?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  stage: string;
  note: string;
  created_at: string;
}

export interface ClientInvoice {
  id: string;
  order_id: string;
  invoice_number: string;
  status: 'Pending' | 'Paid';
  amount_paise: number;
  currency: 'INR' | 'USD';
  due_date: string;
  pdf_storage_path?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  issued_at: string;
  paid_at?: string;
  created_at: string;
  orders?: {
    title: string;
    order_ref: string;
  };
}

export interface ClientPayment {
  id: string;
  invoice_id: string;
  order_id: string;
  client_id: string;
  amount_paise: number;
  currency: string;
  gateway: string;
  gateway_order_id?: string;
  gateway_payment_id: string;
  status: string;
  receipt_number: string;
  captured_at: string;
  invoices?: {
    invoice_number: string;
  };
}

export interface DeliverableFile {
  id: string;
  order_id: string;
  file_name: string;
  storage_path: string;
  file_size_bytes: number;
  mime_type: string;
  created_at: string;
  orders?: {
    title: string;
    order_ref: string;
  };
}

export interface OrderMessage {
  id: string;
  order_id: string;
  sender_id: string;
  sender_role: 'client' | 'admin';
  message_text: string;
  created_at: string;
}

export interface SupportTicket {
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

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  action: string;
  target_table: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

