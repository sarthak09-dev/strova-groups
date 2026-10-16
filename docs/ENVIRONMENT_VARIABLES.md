# Strova Group — Production Environment Variables & Secrets Inventory

**Document Version:** 1.0.0  
**Audit Date:** 2026-10-16  
**Auditor:** Application Security & DevSecOps Engineering  
**Scope:** Marketing Website, Client Portal, Cloudflare Pages Functions, Supabase Edge Functions, CI/CD Pipeline

---

## 1. Classification & Security Rules

All environment variables in the Strova Group platform are strictly categorized according to exposure risk:

1. **PUBLIC (Client-Visible):**
   - Prefixed with `PUBLIC_` in Astro / Vite.
   - Embedded into client-side JavaScript bundles during compilation.
   - Must contain **zero** administrative, service-role, or payment-secret capabilities.
2. **PRIVATE (Server / Edge-Only):**
   - Never prefixed with `PUBLIC_`.
   - Never imported into client-side scripts, components, or HTML.
   - Stored securely in edge runtimes (Supabase Edge Function secrets, Cloudflare Pages environment variables, or GitHub Actions production secrets).

---

## 2. Complete Variable Inventory

| Variable Name | Classification | Target Runtime | Configuration Location | Purpose | Required in Prod? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `PUBLIC_SUPABASE_URL` | **PUBLIC** | Browser, Pages, Edge | Cloudflare Pages & Supabase | Supabase project API gateway endpoint (`https://<id>.supabase.co`). | **YES** |
| `PUBLIC_SUPABASE_ANON_KEY` | **PUBLIC** | Browser, Pages, Edge | Cloudflare Pages & Supabase | Supabase anonymous public key. Grants client access scoped strictly by PostgreSQL Row Level Security (RLS). | **YES** |
| `PUBLIC_TURNSTILE_SITE_KEY` | **PUBLIC** | Browser | Cloudflare Pages Dashboard | Cloudflare Turnstile bot verification site key rendered in browser widget (Starts with `0x4AAAAAAA...`). | **YES** |
| `PUBLIC_RAZORPAY_KEY_ID` | **PUBLIC** | Browser, Edge | Cloudflare Pages & Supabase | Public Razorpay Key ID used to initialize the client-side checkout modal (`rzp_live_...`). | **YES** |
| `SUPABASE_SERVICE_ROLE_KEY` | **PRIVATE** | Supabase Edge Functions | Supabase Dashboard -> Secrets | Privileged service role key used exclusively by server-side Edge Functions (`create-razorpay-order`, `verify-razorpay-payment`, `razorpay-webhook`). Bypasses RLS to execute atomic payment settlement procedures. | **YES** |
| `RAZORPAY_KEY_ID` | **PRIVATE** | Supabase Edge Functions | Supabase Dashboard -> Secrets | Backend gateway key ID for Razorpay API requests. | **YES** |
| `RAZORPAY_KEY_SECRET` | **PRIVATE** | Supabase Edge Functions | Supabase Dashboard -> Secrets | Secret key used to generate and verify HMAC-SHA256 signatures for payment settlement. | **YES** |
| `RAZORPAY_WEBHOOK_SECRET` | **PRIVATE** | Supabase Edge Functions | Supabase Dashboard -> Secrets | Dedicated webhook secret configured in Razorpay Dashboard to sign inbound webhook events. | **YES** |
| `TURNSTILE_SECRET_KEY` | **PRIVATE** | Cloudflare Pages Functions | Cloudflare Pages -> Environment Variables | Secret key for server-side verification of Turnstile challenge tokens (`https://challenges.cloudflare.com/turnstile/v0/siteverify`). | **YES** |
| `WEB3FORMS_ACCESS_KEY` | **PRIVATE** | Cloudflare Pages Functions | Cloudflare Pages -> Environment Variables | Access key for inbound contact form and privacy request email relay. | **YES** (or Formspree) |
| `FORMSPREE_KEY` | **PRIVATE** | Cloudflare Pages Functions | Cloudflare Pages -> Environment Variables | Secondary / fallback email relay credential. | Optional |
| `DATABASE_URL` | **PRIVATE** | Local CLI / CI Verifier | GitHub Actions Production Secret | PostgreSQL connection string (`postgres://postgres:[pwd]@db...`) for executing and verifying migrations. | Optional (for live DB verifier) |
| `PORTAL_SIGNING_SECRET` | **PRIVATE** | Server / Edge Functions | Edge Environment | HMAC-SHA256 key for generating and validating ephemeral signed deliverable download URLs (min 32 chars). | **YES** |

---

## 3. Deployment Preflight Matrix

The automated preflight script (`scripts/preflight.mjs`) verifies variables against strict criteria:

1. **Test-Key Lockout:** Any presence of Razorpay test keys (`rzp_test_*`) or Cloudflare Turnstile dummy keys (`1x00000000000000000000AA`) in `--mode=production` causes an immediate fail-closed exit with code 1.
2. **Template Placeholder Rejection:** Values containing `placeholder`, `your-project`, or `your-anon-key` trigger preflight failure.
3. **Secret Masking:** Preflight output masks all sensitive variables (e.g., `rzp_...45a1`), ensuring zero secret leakage in CI/CD build logs.

---

## 4. Manual Actions Required from Operator

Before switching to live production traffic, the system operator must configure the following values in their respective dashboards:

### In Cloudflare Pages Dashboard (Settings -> Environment Variables -> Production):
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_TURNSTILE_SITE_KEY`
- `PUBLIC_RAZORPAY_KEY_ID`
- `TURNSTILE_SECRET_KEY`
- `WEB3FORMS_ACCESS_KEY`

### In Supabase Dashboard (Project Settings -> Edge Functions -> Secrets):
```bash
supabase secrets set RAZORPAY_KEY_ID="rzp_live_..."
supabase secrets set RAZORPAY_KEY_SECRET="..."
supabase secrets set RAZORPAY_WEBHOOK_SECRET="..."
supabase secrets set PORTAL_SIGNING_SECRET="..."
```

### In Razorpay Dashboard (Settings -> Webhooks):
- **Webhook URL:** `https://<supabase-project-id>.supabase.co/functions/v1/razorpay-webhook`
- **Secret:** Exact value set in `RAZORPAY_WEBHOOK_SECRET`
- **Active Events:** `payment.captured`, `payment.failed`

