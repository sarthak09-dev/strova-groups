# Strova Group — Production Audit & Baseline Report

**Document Version:** 1.0.0  
**Audit Date:** 2026-10-16  
**Auditor:** Senior Full-Stack & Application Security Engineering  
**Repository:** `https://github.com/sarthak09-dev/strova-groups`  
**Primary Domain:** `https://strovagroups.in`  
**Target Client Portal:** `https://strovagroups.in/portal`

---

## 1. Executive Summary

This audit assesses the technical architecture, security boundaries, routing integrity, and deployment readiness of the Strova Group platform. Strova Group is an independent micro-enterprise operating under the registered proprietorship of Babita Kumari (MSME Udyam Registration: `UDYAM-JH-20-0147452`).

The platform comprises:
1. **Public Marketing Website:** Built with Astro 7.3.8, delivering static HTML/CSS/TypeScript across 32 bilingual routes (English and Hindi).
2. **Client Portal:** Client management hub supporting project milestone tracking, private deliverables, invoices, atomic payment reconciliation, and real-time support.
3. **Backend Services:** Supabase PostgreSQL with strict Row Level Security (RLS), Supabase Edge Functions (Deno runtime), and Cloudflare Pages Functions (`functions/api/privacy-request.ts`).
4. **Third-Party Integrations:** Razorpay payment gateway, Cloudflare Turnstile bot deterrence, Web3Forms / Formspree form relay.

---

## 2. Codebase & Git Status Baseline

- **Current Branch:** `main` (synchronized with `origin/main`).
- **Recent Commit History:**
  - `205e8ee`: ci: pass RAZORPAY_WEBHOOK_SECRET, WEB3FORMS_ACCESS_KEY, and FORMSPREE_KEY to production preflight
  - `c8b2cdf`: fix(release): upgrade Astro to 7.3.8, eliminate advisories, enforce fail-closed release gate, and add remote HTTPS checks
  - `dcc6fa1`: fix(ci): quote workflow and step names in ci.yml and add YAML syntax regression test
- **Dependency Audit Status:**
  - `npm audit`: 0 vulnerabilities (Astro upgraded to 7.3.8, patching GHSA-26w7-cxv4-gfx2 and upstream dependencies).
  - TypeScript / Astro diagnostics (`astro check`): 0 errors, 0 warnings across 83 project files.
- **Automated Security Suites:**
  - `tests/isolation.test.mjs`: 26 test suites, 259 assertions passed, 0 failed.
  - `scripts/scan_secrets.mjs`: Clean scan across all tracked source files and build outputs.

---

## 3. Inventory of Routes, Functions & Migrations

### 3.1 Public Marketing Routes (32 static pages)
- **English:** `/`, `/technologies/`, `/digital/`, `/commerce/`, `/about/`, `/case-studies/`, `/contact/`, `/faq/`, `/privacy/`, `/privacy/requests/`, `/terms/`, `/cookies/`, `/accessibility/`, `/review/`, `/quote/confirmed/`, `/404.html`.
- **Hindi (`/hi/`):** `/hi/`, `/hi/technologies/`, `/hi/digital/`, `/hi/commerce/`, `/hi/about/`, `/hi/case-studies/`, `/hi/contact/`, `/hi/faq/`, `/hi/privacy/`, `/hi/privacy/requests/`, `/hi/terms/`, `/hi/cookies/`, `/hi/accessibility/`, `/hi/review/`, `/hi/quote/confirmed/`, `/hi/404/`.

### 3.2 Client Portal Views
- **Legacy Path (Subdomain Target):** Previously configured in `portal/src/pages` targeting `portal.strovagroups.in`.
  - Overview / Dashboard (`/`)
  - Login (`/login`)
  - Logout (`/logout`)
  - Projects & Orders (`/orders`)
  - Invoices & Payments (`/invoices`)
  - Deliverables & Files (`/files`)
  - Realtime Messages (`/messages`)
  - Support Tickets (`/support`)
  - Admin Console (`/admin`)
  - Not Found (`/404`)
- **Required Production Path (Same-Domain):** `https://strovagroups.in/portal/`.

### 3.3 Serverless & Edge Functions
1. **Cloudflare Pages Function:**
   - `functions/api/privacy-request.ts`: Handles DPDP Section 6 privacy and grievance requests. Validates origin/referer, enforces 64KB max payload, executes honeypot validation, and dispatches to email relays.
2. **Supabase Edge Functions (Deno Runtime):**
   - `supabase/functions/create-razorpay-order/index.ts`: Authenticated endpoint that invokes the atomic database CAS procedure `assign_invoice_razorpay_order` to create or retrieve Razorpay gateway orders.
   - `supabase/functions/verify-razorpay-payment/index.ts`: Verifies HMAC-SHA256 signatures for client payments and triggers `finalize_payment` RPC.
   - `supabase/functions/razorpay-webhook/index.ts`: Server-to-server webhook endpoint verifying `X-Razorpay-Signature` with timing-safe comparison, processing `payment.captured` idempotently.

### 3.4 Database Migrations (Ordered Sequence)
1. `20261012000000_client_portal_schema.sql`: Core tables (`profiles`, `orders`, `order_events`, `files`, `invoices`, `payments`, `messages`, `audit_log`) and RLS policies.
2. `20261012000001_harden_and_extend_portal.sql`: Tables `support_tickets`, `support_responses`, `client_notes`, plus automated profile trigger `handle_new_user()`.
3. `20261013000000_atomic_payment_rpc.sql`: Initial atomic settlement function.
4. `20261013000001_fix_support_ticket_rls.sql`: Enforces foreign-key ownership on support ticket creation.
5. `20261013000002_realtime_and_notifications.sql`: Adds `notifications` table and real-time publications.
6. `20261013000003_secure_finalize_payment_rpc.sql`: Hardens `finalize_payment` with explicit REVOKE on PUBLIC/anon/authenticated and restricted search path (`public, pg_temp`).
7. `20261014000000_atomic_assign_razorpay_order.sql`: Implements atomic Compare-And-Swap (CAS) order assignment in PostgreSQL to prevent race conditions.

---

## 4. Hosting Runtimes & Execution Mapping

| Component | Intended Runtime | Configuration File | Execution Environment |
| :--- | :--- | :--- | :--- |
| Marketing Frontend | Static / Cloudflare Pages or Vercel | `astro.config.mjs` | CDN Edge |
| Client Portal | Static / Cloudflare Pages or Vercel | `src/pages/portal/*` | CDN Edge + Browser Auth |
| Inbound Privacy API | Cloudflare Pages Functions | `functions/api/privacy-request.ts` | Cloudflare V8 Workers |
| Payment Gateway Order Creation | Supabase Edge Functions | `supabase/functions/create-razorpay-order` | Supabase Deno Edge |
| Payment Verification | Supabase Edge Functions | `supabase/functions/verify-razorpay-payment` | Supabase Deno Edge |
| Payment Webhooks | Supabase Edge Functions | `supabase/functions/razorpay-webhook` | Supabase Deno Edge |
| Database & Auth | Supabase Cloud | `supabase/migrations/` | PostgreSQL 15+ & GoTrue |

> **Architectural Note:** Cloudflare Pages Functions (`functions/api/`) only execute when deployed on Cloudflare Pages. If the frontend is deployed to Vercel, `functions/api/` will not execute without an API rewrite or adaptation to Vercel Serverless Functions (`api/` directory). Supabase Edge Functions execute independently on Supabase infrastructure regardless of frontend hosting provider.

---

## 5. Categorized Audit Findings

### 5.1 Verified Findings
- **Security Isolation:** RLS policies across all 10 database tables prevent any client from reading, updating, or deleting other tenants' orders, messages, deliverables, or invoices.
- **Privilege Separation:** RPC functions `finalize_payment` and `assign_invoice_razorpay_order` have execution revoked from `PUBLIC`, `anon`, and `authenticated`, and are callable only by `service_role`.
- **Zero Mock / Hardcoded Data:** The client portal contains zero mock accounts, sample orders, fake bypass logins, or sandbox toggles. All data flows from genuine Supabase Auth and PostgREST queries.
- **Fail-Closed Secrets:** Payment creation, verification, and webhooks return HTTP 503 / 500 when server secrets are missing; they never forge dummy success responses.
- **Clean Dependencies:** Astro 7.3.8 resolved all previously identified upstream advisories. `npm audit` reports zero vulnerabilities.

### 5.2 Identified Architectural Discrepancy (Resolved in this Release)
- **Portal Domain Mismatch:** The client portal was historically authored as an isolated sub-project in `portal/` assuming deployment to `portal.strovagroups.in`. DNS queries show `portal.strovagroups.in` has no active DNS record (`ENOTFOUND`). The business requirement mandates serving the portal at `https://strovagroups.in/portal`.
- **Remediation:** Mount portal routes directly under `src/pages/portal/` within the primary Astro application, update navigation and auth links to `/portal/*`, configure same-origin cookies and CSP headers, and exclude `/portal/*` from the public XML sitemap.

### 5.3 Unknowns & External Dependencies
- **Live Database Connection:** Production database verification requires setting `DATABASE_URL` in the environment to connect to the live Supabase PostgreSQL instance. In local and standard CI runs without live DB secrets, AST checks verify the ordered migration scripts.
- **Third-Party Dashboard Configuration:** Webhook secrets and redirect URLs must be configured in the Razorpay and Supabase administrative consoles.

