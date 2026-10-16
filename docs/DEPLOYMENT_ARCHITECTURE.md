# Strova Group — Production Deployment & Runtime Architecture

**Document Version:** 1.0.0  
**Audit Date:** 2026-10-16  
**Primary Host Target:** Cloudflare Pages (Recommended) / Vercel (Supported with functional considerations)  
**Primary Domain:** `https://strovagroups.in`  
**Client Portal Path:** `https://strovagroups.in/portal`  
**Database & Edge Runtime:** Supabase Cloud (PostgreSQL 15+ & Deno Edge)

---

## 1. Architectural Strategy: Same-Domain Client Portal

The Strova Group platform consolidates the public marketing presence and the authenticated client portal onto a single origin: `https://strovagroups.in`.

### Why Same-Domain (`/portal`) Replaces Subdomain (`portal.`):
1. **Cookie & Authentication Scope:** Operating on the same origin (`strovagroups.in`) eliminates cross-subdomain cookie issues, `SameSite` cross-origin complications, and Safari ITP third-party cookie restrictions.
2. **DNS & SSL Simplicity:** A single apex/subdomain record is required for Cloudflare/Vercel edge termination. No secondary SSL certificate provisioning or DNS sub-delegation is needed.
3. **Unified Security Perimeter:** Security headers in `public/_headers` apply holistically across marketing and portal routes while maintaining scoped restrictions for private paths.
4. **Coherent User Experience:** Prospective clients convert seamlessly into active portal users without jarring domain redirects or browser security warnings.

---

## 2. Hosting Runtime Comparison: Cloudflare Pages vs. Vercel

The Strova Group repository contains components designed for specific edge environments. The table below details runtime compatibility:

| Component / Layer | Cloudflare Pages (Recommended) | Vercel Deployment | Action Required for Vercel |
| :--- | :--- | :--- | :--- |
| **Astro Static Output** (`dist/`) | Native static hosting via CDN | Native static hosting via CDN | Set Output Directory to `dist` |
| **Same-Domain Portal** (`dist/portal/`) | Served statically from `dist/portal/` | Served statically from `dist/portal/` | Seamless |
| **Security Headers** (`public/_headers`) | Native support via `_headers` | Configured via `vercel.json` | Translate `_headers` into `vercel.json` headers array |
| **Inbound Privacy API** (`functions/api/privacy-request.ts`) | **Native execution** via Cloudflare Pages Functions (V8) | **Will NOT execute automatically** | Move/adapt to `api/privacy-request.ts` using Vercel Serverless Function syntax |
| **Payment Edge Functions** (`supabase/functions/*`) | Hosted on Supabase Edge Functions (Deno) | Hosted on Supabase Edge Functions (Deno) | None (Executes on Supabase independently) |
| **Database & Auth** | Supabase Cloud | Supabase Cloud | None |

> **Critical Runtime Finding:** Supabase Edge Functions (`create-razorpay-order`, `verify-razorpay-payment`, `razorpay-webhook`) run on Supabase's Deno infrastructure, regardless of whether Cloudflare Pages or Vercel hosts the frontend. However, `functions/api/privacy-request.ts` is a Cloudflare Pages Function. For Vercel deployment, this API route must be declared in `api/` or proxied. Cloudflare Pages is the optimal zero-friction host for this repository.

---

## 3. Directory Layout & Routing Map

```
/home/sarthak/.gemini/antigravity/scratch/strova-group/
├── dist/                              # Astro unified production build output
│   ├── index.html                     # English marketing homepage (/)
│   ├── technologies/index.html        # Technologies service page
│   ├── digital/index.html             # Digital marketing & SEO page
│   ├── commerce/index.html            # Commerce solutions page
│   ├── about/index.html               # About & founder page
│   ├── contact/index.html             # Contact form
│   ├── hi/                            # Complete Hindi localized pages (/hi/*)
│   ├── portal/                        # Unified Client Portal Root (/portal/)
│   │   ├── index.html                 # Client Dashboard Overview (/portal/)
│   │   ├── login/index.html           # Supabase OTP Authentication (/portal/login/)
│   │   ├── logout/index.html          # Safe Session Teardown (/portal/logout/)
│   │   ├── orders/index.html          # Projects, Timeline & Milestones (/portal/orders/)
│   │   ├── invoices/index.html        # Invoices & Razorpay Payments (/portal/invoices/)
│   │   ├── files/index.html           # Private Deliverables (/portal/files/)
│   │   ├── messages/index.html        # Real-time Order Chat (/portal/messages/)
│   │   ├── support/index.html         # Support Ticket Desk (/portal/support/)
│   │   └── admin/index.html           # Operations Admin Console (/portal/admin/)
│   ├── _astro/                        # Vite compiled, content-hashed CSS/JS chunks
│   ├── robots.txt                     # Crawler access rules (disallows /portal/ and /api/)
│   ├── sitemap-index.xml              # Generated XML sitemap (strictly excludes /portal/*)
│   └── llms.txt                       # Structured AI answer file
├── functions/                         # Cloudflare Pages Functions
│   └── api/
│       └── privacy-request.ts         # DPDP Section 6 privacy desk endpoint
├── supabase/
│   ├── functions/                     # Supabase Deno Edge Functions
│   │   ├── create-razorpay-order/     # Order creation with DB CAS lock
│   │   ├── verify-razorpay-payment/   # HMAC signature verification & RPC
│   │   └── razorpay-webhook/          # Server-to-server webhook handler
│   └── migrations/                    # 7 Ordered PostgreSQL migrations
```

---

## 4. Production Deployment Procedure

### 4.1 Step 1: Supabase Database Migration (One-time or on migration updates)
Execute ordered migrations in Supabase SQL editor or via Supabase CLI:
```bash
supabase db push
# or verify privileges
DATABASE_URL="postgres://..." npm run verify:db:live
```

### 4.2 Step 2: Supabase Edge Functions Deployment
Deploy the 3 edge functions to your Supabase project:
```bash
supabase functions deploy create-razorpay-order --no-verify-jwt
supabase functions deploy verify-razorpay-payment --no-verify-jwt
supabase functions deploy razorpay-webhook --no-verify-jwt
```
Set secrets in Supabase Dashboard (or via `supabase secrets set`):
- `RAZORPAY_KEY_ID` (Live: `rzp_live_...`)
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

### 4.3 Step 3: Frontend Build & CDN Deployment
#### If Deploying to Cloudflare Pages:
1. Connect GitHub repository to Cloudflare Pages.
2. Build Settings:
   - **Framework Preset:** Astro
   - **Build Command:** `npm run build`
   - **Build Output Directory:** `dist`
   - **Node.js Version:** `20.x` or `22.x` (configured via environment variable `NODE_VERSION=22`)
3. Environment Variables (Cloudflare Pages Dashboard -> Settings -> Environment Variables):
   - `PUBLIC_SUPABASE_URL`: `https://[your-project].supabase.co`
   - `PUBLIC_SUPABASE_ANON_KEY`: `eyJhbG...`
   - `PUBLIC_TURNSTILE_SITE_KEY`: `0x4AAAAAAA...`
   - `TURNSTILE_SECRET_KEY`: `0x4AAAAAAA...`
   - `PUBLIC_RAZORPAY_KEY_ID`: `rzp_live_...`
   - `WEB3FORMS_ACCESS_KEY`: `...` (or `FORMSPREE_KEY`)

#### If Deploying to Vercel:
1. Connect GitHub repository to Vercel.
2. Build Settings:
   - **Framework Preset:** Astro
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Environment Variables:
   - Same `PUBLIC_*` variables as above.

---

## 5. Rollback & Disaster Recovery Runbook

1. **Frontend Rollback:**
   - Cloudflare Pages / Vercel supports instant one-click rollback to the previous successful deployment SHA from their dashboards.
   - Alternatively, Git revert to the previous release commit and push to `main`.
2. **Database Schema Rollback:**
   - All migrations are non-destructive and backward compatible. RLS policies and functions can be restored by reapplying the desired migration revision.
3. **Gateway Emergency Brake:**
   - In case of gateway anomaly, toggle Razorpay webhook to inactive in Razorpay Dashboard -> Webhooks.

