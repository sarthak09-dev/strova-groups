# Strova Group — Application Security & Threat Model Audit

**Document Version:** 1.0.0  
**Audit Date:** 2026-10-16  
**Auditor:** Senior Application Security & DevSecOps Engineering  
**Application Scope:** Marketing Website (`strovagroups.in`), Client Portal (`strovagroups.in/portal`), Supabase Edge Functions, Cloudflare Pages Functions  
**Classification:** Internal Technical Audit & Compliance Record

---

## 1. Security Architecture & Threat Model

The Strova Group architecture enforces a multi-layer defense-in-depth model across frontend, API edges, edge compute, and the database tier.

```mermaid
flowchart TD
    Client["Browser / Client (Untrusted)"]
    CF["Cloudflare Edge (WAF / HSTS / CSP / Turnstile)"]
    Static["Static CDN Assets (Astro HTML/JS/CSS)"]
    CFWorkers["Cloudflare Pages Functions (/api/privacy-request)"]
    SupabaseAuth["Supabase Auth (GoTrue - Secure JWTs / OTP)"]
    SupabaseEdge["Supabase Edge Functions (Deno Runtime - Private Keys)"]
    Postgres["Supabase PostgreSQL (RLS / Security Definer RPCs)"]
    Razorpay["Razorpay Gateway (Order / Signature / Webhook)"]

    Client -->|HTTPS (TLS 1.3)| CF
    CF -->|Static Cache| Static
    CF -->|Inbound Privacy Form| CFWorkers
    Client -->|Auth / Query via PostgREST| SupabaseAuth
    SupabaseAuth -->|JWT Verification| Postgres
    Client -->|Payment / Webhook| SupabaseEdge
    SupabaseEdge -->|Service Role Key (Strict RPC)| Postgres
    SupabaseEdge -->|Secret Key Auth| Razorpay
```

---

## 2. Row Level Security (RLS) & Database Permissions

All database tables reside in the `public` schema with explicit RLS enforcement. Zero tables permit default public access.

| Table Name | RLS Status | Read Policy (SELECT) | Write Policy (INSERT/UPDATE/DELETE) |
| :--- | :--- | :--- | :--- |
| `public.profiles` | ENABLED | `id = auth.uid() OR is_admin()` | Self-update name only; `role` locked by trigger |
| `public.orders` | ENABLED | `client_id = auth.uid() OR is_admin()` | Admin only; clients cannot modify order terms or stages |
| `public.order_events` | ENABLED | Parent order `client_id = auth.uid() OR is_admin()` | Admin only; clients cannot fabricate timeline milestones |
| `public.files` | ENABLED | Parent order `client_id = auth.uid() OR is_admin()` | Admin only; clients cannot upload rogue files directly |
| `public.invoices` | ENABLED | Parent order `client_id = auth.uid() OR is_admin()` | Admin only; clients cannot alter invoice balance or status |
| `public.payments` | ENABLED | Parent order `client_id = auth.uid() OR is_admin()` | `service_role` via RPC only; clients cannot insert payments |
| `public.messages` | ENABLED | Parent order `client_id = auth.uid() OR is_admin()` | Insert permitted only if client owns order (`sender_id = auth.uid()`) |
| `public.support_tickets` | ENABLED | `client_id = auth.uid() OR is_admin()` | Insert validated: client owns referenced `order_id` (or NULL) |
| `public.support_responses`| ENABLED| Ticket owner or admin | Insert permitted only by ticket owner or admin |
| `public.notifications` | ENABLED | `user_id = auth.uid() OR is_admin()` | Users can update `is_read = true`; insert is admin/service_role only |
| `public.audit_log` | ENABLED | `is_admin()` only | System / trigger insertion only; clients have zero access |

### Privileged Stored Procedures & Access Control
- `public.finalize_payment(...)`:
  - **Security Setting:** `SECURITY DEFINER` with fixed `SET search_path = public, pg_temp`.
  - **Permissions:** Explicitly `REVOKE EXECUTE ON FUNCTION public.finalize_payment FROM PUBLIC, anon, authenticated;`
  - **Grant:** `GRANT EXECUTE ON FUNCTION public.finalize_payment TO service_role;`
  - **Guarantees:** Uses row-level lock (`SELECT ... FOR UPDATE`), enforces status checks, validates that the captured amount matches `invoice.amount_paise`, verifies client ownership, and calculates new order balance atomically.
- `public.assign_invoice_razorpay_order(...)`:
  - **Security Setting:** `SECURITY DEFINER` with fixed `SET search_path = public, pg_temp`.
  - **Permissions:** Execution revoked from `PUBLIC, anon, authenticated`; granted exclusively to `service_role`.
  - **Guarantees:** Implements Compare-And-Swap (CAS) concurrency protection. Competing checkout requests cannot overwrite assigned gateway orders without verifying status.

---

## 3. Secret Isolation & Zero-Leakage Guarantee

An automated AST and regex scan is enforced via `scripts/scan_secrets.mjs`.

### Variable Separation Matrix
| Variable | Access Level | Permitted Environments | Client Asset Leak Risk |
| :--- | :--- | :--- | :--- |
| `PUBLIC_SUPABASE_URL` | Public | Browser, Edge, Functions | None (Public API URL) |
| `PUBLIC_SUPABASE_ANON_KEY` | Public | Browser, Edge, Functions | None (Protected by PostgreSQL RLS) |
| `PUBLIC_TURNSTILE_SITE_KEY` | Public | Browser | None (Public Widget Sitekey) |
| `PUBLIC_RAZORPAY_KEY_ID` | Public | Browser, Edge Functions | None (Public Gateway Key ID) |
| `SUPABASE_SERVICE_ROLE_KEY` | **PRIVATE** | Supabase Edge Functions | **ZERO** (Never in Vite build) |
| `RAZORPAY_KEY_SECRET` | **PRIVATE** | Supabase Edge Functions | **ZERO** (Never in Vite build) |
| `RAZORPAY_WEBHOOK_SECRET` | **PRIVATE** | Supabase Edge Functions | **ZERO** (Never in Vite build) |
| `TURNSTILE_SECRET_KEY` | **PRIVATE** | Cloudflare Pages Functions | **ZERO** (Never in Vite build) |
| `DATABASE_URL` | **PRIVATE** | Server-side CLI / Admin | **ZERO** (Never in Vite build) |
| `WEB3FORMS_ACCESS_KEY` | **PRIVATE** | Cloudflare Pages Functions | **ZERO** (Never in Vite build) |

- **Storage Security:** No private credentials, JWT tokens, or API secrets are stored in `localStorage` or `sessionStorage`. Supabase Auth securely manages authentication state in cookies/tokens adhering to modern browser security policies.
- **Git Protection:** `.gitignore` excludes `.env`, `.env.*` variants, `*.pem`, `*.key`, and all build output directories (`dist/`, `portal/dist/`).

---

## 4. Payment Security & Webhook Hardening

### Threat: Client-Side Tampering of Invoice Settlement
- **Mitigation:** The frontend never marks an invoice as "Paid". Checkout initiates a server-side call to `create-razorpay-order`, which executes in a secure Deno edge environment using `SUPABASE_SERVICE_ROLE_KEY`.
- **Mitigation:** On payment completion, Razorpay provides `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature`. These parameters are posted to `verify-razorpay-payment`, which re-calculates HMAC-SHA256:
  $$\text{HMAC-SHA256}(\text{order\_id} \mathbin{\Vert} \text{"|"} \mathbin{\Vert} \text{payment\_id}, \text{RAZORPAY\_KEY\_SECRET})$$
  and executes a timing-safe equality check before invoking the atomic database procedure `finalize_payment`.

### Threat: Webhook Forgery & Replay Attacks
- **Mitigation:** `supabase/functions/razorpay-webhook/index.ts` reads the raw request body text and verifies `X-Razorpay-Signature` against `RAZORPAY_WEBHOOK_SECRET` using timing-safe comparison.
- **Idempotency:** If a duplicate `payment.captured` event arrives for an invoice already marked `Paid`, the function safely acknowledges with HTTP 200 without double-crediting or recalculating balances.
- **Fail-Closed:** Missing webhook secrets return HTTP 503; invalid signatures return HTTP 400.

---

## 5. Client Authentication & Session Security

- **Authentication Method:** Supabase Magic Link / Email One-Time Passcode (OTP).
- **Anti-Bot Protection:** Cloudflare Turnstile token validation protects both the login form and inbound contact forms.
- **Strict Invite-Only Mode:** `signInWithOtp` operates with `shouldCreateUser: false`. Arbitrary visitors cannot self-register as clients. Account creation is an authorized administrative onboarding action.
- **Role Escalation Protection:** The database trigger `handle_new_user()` enforces default role `'client'` and ignores any `role: 'admin'` injected into `raw_user_meta_data`. Staff permissions are granted only through explicit server-side database administration.
- **Session Termination:** The logout endpoint (`/portal/logout/`) calls `supabase.auth.signOut()`, purges active realtime channels, and clears session data.

---

## 6. Content Security Policy (CSP) & HTTP Headers

Applied via `public/_headers` on Cloudflare Pages / edge reverse proxy:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-XSS-Protection: 0
```

### Portal Specific CSP (`/portal/*`):
- `default-src 'self'`
- `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://challenges.cloudflare.com`
- `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://challenges.cloudflare.com`
- `frame-src https://checkout.razorpay.com https://api.razorpay.com https://challenges.cloudflare.com`
- `frame-ancestors 'none'`
- `Cache-Control: private, no-cache, no-store, must-revalidate`

---

## 7. Verification Results & Regression Status

| Security Test Suite | Scope | Result |
| :--- | :--- | :--- |
| Test Suite 1: Orders Tenant Isolation | Cross-tenant orders query | **PASS** (0 cross-tenant rows) |
| Test Suite 2: Timeline Isolation | Cross-tenant milestone query | **PASS** (0 cross-tenant rows) |
| Test Suite 3: Files Isolation | Cross-tenant deliverable query | **PASS** (0 cross-tenant rows) |
| Test Suite 4: Invoices Isolation | Cross-tenant invoice query | **PASS** (0 cross-tenant rows) |
| Test Suite 5: Messages Tampering | Cross-tenant message insertion | **PASS** (Blocked with 403) |
| Test Suite 6: Signed Download URLs | 60-second HMAC signed URLs | **PASS** (410 expired, 403 tampered) |
| Test Suite 7: Audit Log Privacy | Client query on audit logs | **PASS** (RLS returns 0 rows) |
| Test Suite 8: Razorpay Signatures | Forged signature detection | **PASS** (Rejected) |
| Test Suite 9: Privilege Escalation | Metadata role injection | **PASS** (Neutralized to client) |
| Test Suite 10: Turnstile Bot Challenge | Forged bot tokens | **PASS** (Rejected) |
| Test Suite 11: Stored XSS Escaping | Script tag entity encoding | **PASS** (Strictly encoded) |
| Test Suite 12: Fail-Closed Gateways | Unconfigured gateway keys | **PASS** (Returns 503) |
| Test Suite 15: Atomic Reconciliation | Balance state machine & CAS | **PASS** (Zero double-credits) |
| Test Suite 24: Concurrent CAS Order | Race condition mitigation | **PASS** (Atomic assignment) |
| Test Suite 26: Secret Scanning Gate | Source & bundle scan | **PASS** (0 leaks) |

