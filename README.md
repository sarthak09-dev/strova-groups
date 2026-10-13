# Strova Group — Production Static Website & Client Portal

> **Technology, commerce, and digital growth for growing businesses.**  
> Official web platform for **Strova Group** (`https://strovagroups.in`) and the invite-only client portal (`https://portal.strovagroups.in`).

---

## 1. Executive Summary & Brand Identity

- **Brand Name**: **Strova Group** (Never bare "Strova" alone).
- **Group Tagline**: *"Technology, commerce, and digital growth for growing businesses."* (Note: *"AI and automation"* belongs exclusively to the Technologies division).
- **Operating Divisions**:
  1. **Strova Technologies**: Websites, Android apps, custom software, WhatsApp and AI automation.
  2. **Strova Digital**: SEO, ads, social media, lead generation.
  3. **Strova Commerce**: High-speed storefronts and WhatsApp catalog checkouts (Marked *"Coming soon"*).
- **Ownership & Legal Structure**:
  - **Founder**: Sarthak Shresht (flagged for spelling confirmation).
  - **Legal Owner per Udyam**: Babita Kumari, proprietor.
  - **Udyam MSME Registration**: `UDYAM-JH-20-0147452`.
  - **Legal Declaration** (rendered on Footer, Terms, Privacy, About, and Organization schema):  
    *"Strova Group is a proprietorship of Babita Kumari"*.
  - **Flag for Legal/CA Review**: Needs formal Chartered Accountant confirmation prior to filing.
- **Official Contact**:
  - Email: `info@strovagroups.in`
  - Telephone & WhatsApp: `+91 92880 77802` (`tel:+919288077802`, `https://wa.me/919288077802`)
  - Hours: Monday–Saturday, 10:00 AM – 7:00 PM IST (UTC+5:30)

---

## 2. Architecture & Tech Stack

The platform is architected into two decoupled systems:
1. **Marketing Site (`https://strovagroups.in`)**: 100% static Astro site (`output: "static"`). Zero server vulnerabilities, zero database dependencies, zero tracking cookies. Instant static edge delivery via Cloudflare Pages.
2. **Client Portal (`https://portal.strovagroups.in`)**: Invite-only authenticated client workspace built with Supabase (Auth, Postgres, Storage, Row Level Security) and `@supabase/ssr`.

- **Framework**: [Astro v5](https://astro.build/)
- **Design System**: Editorial permanent light design tokens with Newsreader Variable (serif) and Plus Jakarta Sans Variable (sans). High-contrast `#0F172A` ink typography on crisp `#FFFFFF` and subtle `#F8FAFC` surfaces with permanent `color-scheme: light`.
- **3D Graphics & Motion**:
  - Three.js physical kinetic sculpture on homepage hero with WebGL detection, pixel ratio capped at 2, IntersectionObserver pause/resume, and accessible SVG fallback.
  - Lightweight GSAP interactions and CSS scroll-driven progress animations.
- **Analytics**: Cookieless, privacy-preserving event tracking (`quote_form_started`, `quote_form_submitted`, `email_click`, `whatsapp_click`). Zero third-party trackers on marketing pages; zero trackers on the portal.
- **Forms & Security**:
  - Quote form with Cloudflare Turnstile bot verification and fail-closed `/api/contact` Cloudflare Pages Function.
  - Returns HTTP 503 if the backend relay key is unconfigured, displaying direct contact information (`info@strovagroups.in` and WhatsApp). Never fakes success.

---

## 3. Directory Structure

```
strova-group/
├── astro.config.mjs               # Root Astro config for marketing site
├── audit.mjs                      # Automated site audit script (100% pass score)
├── package.json                   # Build scripts & dependencies
├── tsconfig.json                  # TypeScript configuration
├── functions/
│   └── api/
│       └── contact.ts             # Fail-closed Cloudflare Pages Function for quote submissions
├── public/
│   ├── .well-known/
│   │   └── security.txt           # RFC 9116 security vulnerability disclosure policy
│   ├── _headers                   # Cloudflare Pages CSP, HSTS, and security headers
│   ├── favicon.svg                # Vector brand favicon
│   ├── llms.txt                   # One-sentence summaries of all main pages for LLM crawlers
│   ├── robots.txt                 # Search & AI crawler policies (disallows /portal and /api/)
│   ├── site.webmanifest           # Web app manifest for Strova Group
│   └── fonts/                     # 100% self-hosted variable font files (Newsreader & Plus Jakarta Sans)
├── src/
│   ├── content/                   # Content collections (journal & work with draft templates)
│   ├── components/                # Header, Footer, SEOHead, ThreeHero, CredentialsStrip
│   ├── layouts/
│   │   └── BaseLayout.astro       # Root layout with schemas, skip link, and sticky quote bar
│   ├── pages/
│   │   ├── index.astro            # Homepage (9-stage conversion narrative, "How quotes work", FAQ)
│   │   ├── technologies.astro     # Strova Technologies (AI & automation housed here)
│   │   ├── digital.astro          # Strova Digital (SEO, Ads, Funnels, CAPI)
│   │   ├── commerce.astro         # Strova Commerce ("Coming soon")
│   │   ├── about.astro            # Corporate identity, leadership, Udyam MSME credentials
│   │   ├── contact.astro          # 3-field quote form with Turnstile & fail-closed fallback
│   │   ├── review.astro           # Ungated, zero-incentive Google review request page
│   │   ├── privacy.astro          # DPDP Act 2023 & GDPR aligned Privacy Policy
│   │   ├── terms.astro            # Anti-copying / anti-scraping terms & 30-day warranty
│   │   ├── cookies.astro          # Cookie policy (zero marketing cookies)
│   │   ├── accessibility.astro    # WCAG 2.2 AA accessibility statement
│   │   └── 404.astro              # Branded 404 recovery page
│   └── scripts/
│       ├── analytics.ts           # Privacy-preserving cookieless event dispatcher
│       └── globalInteractions.ts  # IST clock ticker, anchor smooth scroll, card sheen effects
├── portal/                        # Client Portal application (portal.strovagroups.in)
│   ├── astro.config.mjs           # Portal Astro config
│   ├── public/
│   │   └── robots.txt             # Disallow: / on portal domain
│   └── src/
│       ├── lib/
│       │   └── supabase.ts        # Supabase client, models, and 60s signed link generator
│       ├── layouts/
│       │   └── PortalLayout.astro # Portal layout with noindex, no trackers, DPDP link
│       └── pages/
│           ├── index.astro        # Client orders dashboard with 8-stage badges
│           ├── login.astro        # 6-digit OTP login, 10-min expiry, 60s resend, demo switch
│           ├── logout.astro       # Session termination
│           ├── orders/
│           │   ├── index.astro    # Order detail with 8-stage timeline, deliverables, invoices
│           │   └── [id].astro     # Dynamic route slug
│           └── admin/
│               └── index.astro    # Admin console (orders, milestones, deliverables, audit log)
├── supabase/
│   └── migrations/
│       └── 20261012000000_client_portal_schema.sql # PostgreSQL schema & RLS policies
└── tests/
    └── isolation.test.mjs         # Automated tenant isolation & RLS test suite (39 assertions)
```

---

## 4. Environment Variables Reference

Configure these in Cloudflare Pages dashboard (`Settings > Environment variables`) and `.env`:

| Variable | Environment | Required | Description |
| :--- | :--- | :--- | :--- |
| `PUBLIC_GOOGLE_SITE_VERIFICATION` | Client | Optional | Google Search Console verification code for `<meta name="google-site-verification">`. |
| `PUBLIC_BING_SITE_VERIFICATION` | Client | Optional | Bing Webmaster Tools verification code for `<meta name="msvalidate.01">`. |
| `PUBLIC_TURNSTILE_SITE_KEY` | Client | Optional | Cloudflare Turnstile site key for interactive bot challenge. |
| `TURNSTILE_SECRET_KEY` | Server | Optional | Cloudflare Turnstile secret key for server-side response verification. |
| `WEB3FORMS_ACCESS_KEY` | Server | Required for email relay | Web3Forms access key. If omitted, `/api/contact` fails closed with HTTP 503. |
| `PUBLIC_GOOGLE_REVIEW_URL` | Client | Optional | Direct Google Business Profile review link for `/review`. Defaults to email request. |
| `PUBLIC_LINKEDIN_URL` | Client | Optional | Verified company LinkedIn URL for Organization schema `sameAs`. |
| `PUBLIC_GITHUB_URL` | Client | Optional | Verified company GitHub URL for Organization schema `sameAs`. |
| `PUBLIC_INSTAGRAM_URL` | Client | Optional | Verified company Instagram URL for Organization schema `sameAs`. |
| `PUBLIC_YOUTUBE_URL` | Client | Optional | Verified company YouTube URL for Organization schema `sameAs`. |
| `PUBLIC_GOOGLE_BUSINESS_URL` | Client | Optional | Google Maps / GBP link for Organization schema `sameAs`. |
| `PUBLIC_CLUTCH_URL` | Client | Optional | Clutch company profile link for Organization schema `sameAs`. |
| `SUPABASE_URL` | Portal | Required for live portal | Supabase project URL (`https://<project>.supabase.co`). |
| `SUPABASE_ANON_KEY` | Portal | Required for live portal | Supabase anonymous/public key (respects RLS). |
| `SUPABASE_SERVICE_ROLE_KEY` | Portal Server | Required for admin portal | Supabase service role key (never expose to browser). |
| `PORTAL_SIGNING_SECRET` | Portal Server | Required | Secret string for HMAC-SHA256 60-second signed file download URLs. |
| `PUBLIC_RAZORPAY_KEY_ID` | Portal Client | Optional (Test mode default) | Razorpay public key ID (`rzp_test_...` or `rzp_live_...`). |
| `RAZORPAY_KEY_SECRET` | Edge Function Server | Required for live payments | Razorpay secret key for server-side order generation and signature verification. |
| `RAZORPAY_WEBHOOK_SECRET` | Edge Function Server | Required for live webhooks | Razorpay webhook secret for verifying captured payment webhooks. |

---

## 5. Local Setup & Build Commands

```bash
# Install dependencies
npm install

# Run marketing site in development
npm run dev

# Run automated tenant isolation test suite
npm test

# Run comprehensive static build audit
npm run audit

# Build static marketing site
npm run build

# Build client portal app
npm run build:portal

# Build both applications
npm run build:all

# Preview production build locally
npm run preview
```

---

## 6. Supabase & Client Portal Setup Guide

### Applying Database Schema & Row Level Security
1. Navigate to your Supabase project dashboard > **SQL Editor**.
2. Open and run `supabase/migrations/20261012000000_client_portal_schema.sql`.
3. This creates:
   - `profiles`: Tied to `auth.users`, role-based (`client` or `admin`).
   - `orders`: Project engagements linked to client profiles.
   - `order_events`: 8-stage progress timeline events (`Brief received` through `Support`).
   - `files`: Deliverable metadata with private storage paths.
   - `invoices`: Invoices with `Pending` or `Paid` status (zero public price lists).
   - `messages`: Per-order client communication thread.
   - `audit_log`: Administrative operation audit trail.
   - Strict **Row Level Security (RLS)** on all tables preventing cross-client visibility.

### Configuring Custom SMTP Sender
By default, Supabase's built-in email service is rate-limited (3 emails/hour). For production:
1. In Supabase Dashboard, go to **Project Settings > Authentication > SMTP Settings**.
2. Enable **Custom SMTP**.
3. Sender Email: `info@strovagroups.in`.
4. Sender Name: `Strova Group`.
5. Enter host, port (587/465), user, and SMTP password provided by your mail provider (e.g., Zoho, Google Workspace, AWS SES).

### Inviting a Client & Creating an Order
1. Sign in to the portal as admin at `https://portal.strovagroups.in/admin`.
2. **Invite / Provision Client**: Enter the client's business email and company name. Supabase provisions the auth user and sends an invite email.
3. **Create Order**: Select the client profile, assign division (`technologies`, `digital`, `commerce`), and title.
4. **Advance Milestone**: Select order, pick stage from the 8 stages, and enter a client-visible progress note.
5. **Upload Deliverable**: Store files in private Supabase Storage bucket `deliverables` under `client_<id>/orders/<order_id>/` and link the path in the admin form.

---

## 7. Publishing Content in Journal and Work

The platform utilizes Astro Content Collections with automatic navigation visibility:
- When a collection has **0 published entries**, the navigation links (`Work`, `Journal`) in the Header and Footer **automatically stay hidden**.
- No empty pages or placeholder text are ever rendered.

### To publish a Journal article:
1. Copy `src/content/journal/draft-template.md` to `src/content/journal/your-article-slug.md`.
2. Fill in title, description, publishDate, and markdown content.
3. Set `draft: false`.
4. Run `npm run build`. The Journal page and navigation link will automatically become active.

### To publish a Work case study:
1. Ensure you have documented written client permission, real facts, and verifiable metrics.
2. Copy `src/content/work/draft-template.md` to `src/content/work/client-case-slug.md`.
3. Fill in title, client (real only), division, deliverable summary, and results.
4. Set `draft: false`.
5. Run `npm run build`. The Work page and navigation link will automatically become active.

---

## 8. Intellectual Property Protection & Canary Phrases

To protect site copy and architecture from unauthorized automated scraping and plagiarism, 4 unique, domain-specific canary phrases are embedded across key pages:

| Location | Canary Phrase | Detection Purpose |
| :--- | :--- | :--- |
| `src/pages/about.astro` | *"Strova Group maintains an uncompromising standard of deterministic execution, pairing senior architectural oversight with rigorous verification across every deliverable."* | About page scrapers |
| `src/pages/terms.astro` | *"Strova Group enforces strict provenance tracking across proprietary codebase structures and analytical methodologies, prohibiting unauthorized automated scraping or model ingestion."* | Legal terms re-use |
| `src/pages/technologies.astro` | *"Strova Technologies builds resilient digital foundations with verifiable latency thresholds, ensuring zero single-point failures in custom software infrastructure."* | Service page copying |
| `src/pages/digital.astro` | *"Strova Digital executes performance growth architectures that unify server-side event tracking with transparent, first-party data attribution."* | Agency copy cloning |

### Recommended Cloudflare Protection:
1. **Bot Fight Mode**: Enable in Cloudflare Dashboard under **Security > Bots**. Challenges known malicious scrapers.
2. **Rate Limiting Rule**: Limit requests to `/api/*` to a maximum of 5 requests per 10-minute window per IP.
3. **Private Repository**: Keep the git repository private to safeguard internal code and portal structures.
4. **Misuse Reporting**: The Terms page includes a direct reporting link: `mailto:info@strovagroups.in?subject=Report%20misuse%20or%20unauthorized%20copying`.

---

## 9. Technical SEO & Search Engine Indexing Checklist

1. **Verify Ownership**:
   - Google Search Console: Set `PUBLIC_GOOGLE_SITE_VERIFICATION` in Cloudflare Pages environment variables.
   - Bing Webmaster Tools: Set `PUBLIC_BING_SITE_VERIFICATION` in Cloudflare Pages environment variables.
2. **Submit Sitemap**:
   - Submit `https://strovagroups.in/sitemap-index.xml` in both Search Console and Bing.
3. **Request Indexing**:
   - In Search Console, inspect `https://strovagroups.in/` and click **Request Indexing**.
4. **AI Crawlers & robots.txt Policy**:
   - Search & retrieval bots (`OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`) are explicitly **allowed** to ensure Strova Group answers show in AI search.
   - Training crawlers (`GPTBot`, `ClaudeBot`, `Google-Extended`, `CCBot`) default to **allowed** in `public/robots.txt` with clear comments explaining how to disallow them if training opt-out is preferred.
   - `/portal/` and `/api/` are strictly **disallowed** for all robots.
5. **Weekly Brand Search Check**:
   - Perform a weekly search in a private/incognito window for the exact query `"Strova Group"` to verify snippet rendering, Knowledge Panel, and sitelinks.

---

## 10. Automated Verification & Isolation Test Suite

The repository includes two automated test and audit suites:

### 1. Tenant Isolation Suite (`npm test` / `tests/isolation.test.mjs`)
Executes 125 automated assertions across 22 comprehensive test suites verifying:
- Client Alpha (`client-a@example.com`) receives strictly Client Alpha orders, events, files, invoices, and messages. Zero rows returned for Client Beta.
- Client Beta (`client-b@example.com`) receives strictly Client Beta records. Zero rows returned for Client Alpha.
- Cross-tenant ID enumeration queries return 0 rows.
- Cross-tenant message insertion is rejected with HTTP 403.
- Private deliverable signed download links reject unauthorized clients (403 Forbidden).
- Expired download links (> 60s) reject downloads (410 Expired).
- Tampered link signatures are rejected (403 Invalid signature).
- Administrator session can view cross-client orders and audit log entries.
- Non-admin client sessions querying audit log receive 0 rows.
- Razorpay payment signature verification & idempotency.
- Role privilege escalation prevention during signup.
- Stored XSS neutralization & URL protocol sanitization.
- Fail-closed gateway validation & secrets enforcement.
- Cross-client invoice checkout tampering prevention.
- Contact API origin/referer validation and 64KB payload limits.
- Atomic payment reconciliation state machine & RPC balance calculation.
- Webhook cryptographic HMAC-SHA256 signature verification.
- Support ticket cross-client order association prevention.
- Realtime notifications tenant isolation and read receipts.
- Permanent light theme enforcement and dark mode selector purge.
- RPC privilege restrictions: `finalize_payment` granted exclusively to `service_role`, revoked from `PUBLIC, anon, authenticated`.
- Gateway verification & webhook fail-closed boundaries (deletion of direct DB fallbacks, 500 retry triggers).
- Cloudflare Turnstile bot protection: prohibition of test keys in production and bilingual response handling.

### 2. Static Build Audit (`npm run audit` / `audit.mjs`)
Audits all rendered HTML pages in `dist/`:
- Exactly one `<h1>` per page.
- Title strictly under 60 characters and description strictly under 160 characters.
- Valid canonical URL on `https://strovagroups.in`.
- Multi-locale hreflang (`en`, `en-IN`, `x-default`).
- Organization schema validation (legalName, name, founder, telephone, email, Udyam identifier).
- Zero instances of bare "Strova" alone as the brand name.
- Zero public prices, rupee symbols (`₹`), or "starting from" figures.
- Zero bracket placeholders (`[ADDRESS]`, `[ROLE TITLE]`, `TODO`, `Lorem`).
- Self-hosted variable fonts verified (zero CDN font requests).
- Non-Three.js JS bundle size verified within 150 KB raw budget.

---

## 11. Missing Information Report

The following items were not supplied in the initial brief and have been omitted from public pages according to the Absolute Rules (never invent facts):

1. **Physical Office Street Address**: Omitted from Header, Footer, and Contact page. Email (`info@strovagroups.in`), phone (`+91 92880 77802`), and Udyam MSME number (`UDYAM-JH-20-0147452`) are displayed instead.
2. **Founder Photograph**: A clean geometric vector icon / monogram is rendered instead of a stock or placeholder photo.
3. **Case Study Metrics & Client Logos**: Case Studies page displays production architecture blueprints with zero invented client names or metrics. The `work` content collection remains hidden until real client-approved entries are added.
4. **Social Profile URLs**: Organization schema `sameAs` only includes profiles when set via environment variables.

---

## 12. Needs Human Confirmation Report

Prior to formal commercial deployment, confirm the following items:

1. **Founder Name Spelling**: Confirm exact spelling of *"Sarthak Shresht"*.
2. **Chartered Accountant (CA) Review**: Confirm the proprietorship legal structure disclosure (*"Strova Group is a proprietorship of Babita Kumari"*) and invoice numbering format with your CA.
3. **Legal Counsel Review**: Have legal counsel review `src/pages/terms.astro` and `src/pages/privacy.astro` for specific compliance with India's Digital Personal Data Protection (DPDP) Act 2023.
4. **Google Review Link**: Verify the exact Google Business Profile review destination URL for `PUBLIC_GOOGLE_REVIEW_URL`.
5. **Mailgun / Web3Forms Key**: Obtain access key for `WEB3FORMS_ACCESS_KEY` to enable production email dispatch from the quote form.

---

## 13. Production Operations & Deployment Guide

### A. Deployment Target & Architecture
- **Marketing Site (`https://strovagroups.in`)**: Deployed via Cloudflare Pages using `npm run build` with output in `dist/`.
- **Client Portal (`https://portal.strovagroups.in`)**: Deployed via Cloudflare Pages using `npm run build:portal` with output in `portal/dist/`.
- **Database & Auth (`Supabase`)**: Managed PostgreSQL with Row Level Security (RLS) and email OTP passwordless authentication.
- **Serverless Payment Endpoints**: Hosted as Supabase Edge Functions (`supabase/functions/create-razorpay-order` and `supabase/functions/verify-razorpay-payment`).

### B. Database Migration Execution
Apply the migrations in numerical order to your Supabase project (via CLI `supabase db push` or in the Supabase Dashboard SQL Editor):

1. `20261012000000_client_portal_schema.sql`: Core schema (profiles, orders, deliverables, invoices, payments, audit_log, RLS)
2. `20261012000001_harden_and_extend_portal.sql`: Schema extensions, indices, client isolation policies
3. `20261013000000_atomic_payment_rpc.sql`: Initial atomic payment reconciliation function
4. `20261013000001_fix_support_ticket_rls.sql`: Support tickets order ownership check
5. `20261013000002_realtime_and_notifications.sql`: Realtime tables and notifications publication
6. `20261013000003_secure_finalize_payment_rpc.sql`: Production-hardened `finalize_payment` RPC with row locking, currency/amount strict checks, cross-invoice reuse guards, and exclusive `service_role` execute permission.

```bash
# Link your Supabase CLI to your project
supabase link --project-ref your-project-ref

# Push migrations in sequence
supabase db push
```

### C. Supabase Authentication Setup
1. In Supabase Dashboard -> **Authentication** -> **Providers** -> **Email**:
   - Enable Email provider.
   - Disable password-based signup if invite-only.
   - Enable "Confirm email" and set OTP expiration to 10 minutes (600 seconds).
2. In Supabase Dashboard -> **Authentication** -> **Bot Protection**:
   - Enable Cloudflare Turnstile bot protection.
   - Enter your `TURNSTILE_SECRET_KEY`.
3. In Supabase Dashboard -> **URL Configuration**:
   - Site URL: `https://portal.strovagroups.in`
   - Additional Redirect URLs: `https://portal.strovagroups.in/**`, `https://strovagroups.in/**`

### D. Razorpay Live Configuration
1. Obtain Live Key ID and Key Secret from Razorpay Dashboard -> **Settings** -> **API Keys**.
2. Set `PUBLIC_RAZORPAY_KEY_ID=rzp_live_...` in your portal environment variables.
3. Configure `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` as Supabase Edge Function secrets:
```bash
supabase secrets set RAZORPAY_KEY_SECRET="your_live_secret" RAZORPAY_WEBHOOK_SECRET="your_webhook_secret"
```
4. In Razorpay Dashboard -> **Settings** -> **Webhooks**:
   - Add Webhook URL: `https://your-project-id.supabase.co/functions/v1/razorpay-webhook`
   - Active Events: `payment.captured`, `payment.failed`, `order.paid`
   - Secret: Matches `RAZORPAY_WEBHOOK_SECRET`

### E. Backup & Recovery Considerations
- **Database Snapshots**: Supabase provides automated daily backups with Point-in-Time Recovery (PITR) on Pro tier.
- **Rollback Procedure**: In case of deployment rollback, Cloudflare Pages supports instant 1-click rollbacks to previous immutable deployments.
