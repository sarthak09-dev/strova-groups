# Strova Group — End-to-End Project Handoff

**Prepared:** 29 October 2026
**Repository:** https://github.com/sarthak09-dev/strova-groups
**Baseline revision checked:** 5673f56594d55a3126cd12768902baa9eb251078 (main was clean and aligned with origin/main before this handoff and visual-performance pass)
**Public domain:** https://www.strovagroups.in; Astro canonical configured as https://strovagroups.in
**Client Hub:** https://www.strovagroups.in/portal/
**Status:** Repository-based handoff. It is not a legal opinion or an independent audit of hosting/provider dashboards.

---

## 1. What the website and business are

Strova Group is the parent business brand. The site introduces its services, handles inquiries and privacy requests, and provides a private workspace for existing clients.

**Intended business hierarchy:**
**Strova Group → Strova Technology → Digital | Automation | Products**

The pillars are integrated service/product areas within one technology business, not separate companies:

- **Digital:** business websites and landing pages, web apps and customer portals, e-commerce, custom digital platforms.
- **Automation:** business-process and workflow automation, CRM/operations integrations, appropriate AI integrations, repetitive task automation.
- **Products:** SaaS applications, reusable software, digital tools and platforms built around validated customer needs.

### Current content mismatch

Current pages such as the homepage, /technologies/, and /digital/ already use the Strova Technology framing. Other navigation/page copy still uses legacy labels such as Strova Technologies, Strova Digital and Strova Commerce, including a separate /commerce/ page. The root README and several older dated docs also describe an earlier brand and portal model. Align remaining visitor-facing wording with the approved hierarchy, and label planned products as planned until launched. Do not imply separate legal entities.

### Business facts in source (not independently revalidated)

- Founder: Sarthak Shreshth.
- Legal owner/proprietor described in the site: Babita Kumari.
- Udyam identifier: UDYAM-JH-20-0147452.
- Contact details: info@strovagroups.in, support@strovagroups.in, +91 92880 77802 (telephone/WhatsApp).
- Hours recorded: Monday–Saturday, 10:00 AM–7:00 PM IST.

These details are transcribed from repository content. Confirm against business/government records before legal filings or regulated disclosures.

---

## 2. User journeys

### Prospective customer

1. Visits English / or Hindi /hi/.
2. Explores Technology, Digital, Commerce, About, Case Studies, FAQ, Contact and legal information.
3. Sends an inquiry through the quote/contact form, email or WhatsApp.
4. May submit a rights request at /privacy/requests/ (Hindi equivalent /hi/privacy/requests/).
5. May request Client Hub access. This creates a pending application, not an account or automatic approval.

### Existing client

1. Opens /portal/login/, enters email and completes Turnstile.
2. Requests an email OTP or magic link from Supabase Auth.
3. Enters the six-digit code or follows the configured link, then verifies with Supabase.
4. Login is invite-only: the code uses shouldCreateUser: false. The login page is not a public account creation route.
5. Authenticated views include projects/orders and milestones, invoices/payments, private files, messages and support.
6. Logout: /portal/logout/.

The user has reported that OTP/magic-link now works after adjusting Supabase redirect/template settings. That is user-reported production verification; this handoff did not authenticate through the live project or a real inbox.

### Operations and client access approval

The admin UI is at /portal/admin/. Source includes client onboarding/invites, projects, milestones, invoices, support responses and operational records. Real authorization must be enforced by Supabase roles and RLS, not by hiding a browser page.

Client access applications are separate: supabase/functions/request-client-access/ writes pending requests to a private table. It does not approve applications, create Auth users or send invitations. An integrated admin approval queue remains outstanding. Until then, review in a trusted Supabase administrative interface. Never ship a service-role key in a browser or desktop app.

---

## 3. Architecture and repository map

### Stack

- Astro static site generation, TypeScript/JavaScript, Astro components and CSS.
- @astrojs/sitemap for the public sitemap.
- Self-hosted Newsreader Variable and Plus Jakarta Sans Variable fonts.
- Homepage hero is a lightweight inline SVG mark with CSS entrance treatment. The repository contains a standalone ThreeHero component and the Three.js/GSAP dependencies, but the component is not imported by the active pages and these libraries are not part of the homepage route bundle.
- Supabase Auth, Postgres, Storage, RLS, Realtime and Deno Edge Functions.
- Cloudflare Turnstile.
- Razorpay checkout, server-side verification and webhook handling.
- Root site and separate portal Astro build. The root build also includes same-domain /portal/ routes.

### Key paths

| Path | Purpose |
|---|---|
| src/pages/ | English public pages and integrated portal pages |
| src/pages/hi/ | Hindi public pages |
| src/components/ | Header, footer, SEO head, hero, credentials and shared UI |
| src/layouts/BaseLayout.astro | Public site layout/metadata |
| src/layouts/PortalLayout.astro | Integrated portal layout |
| src/lib/portal/ | Main-site portal clients, types, sanitization, realtime helpers |
| portal/src/ | Separate portal app and duplicated/standalone views |
| supabase/migrations/ | Ordered DB schema, RLS, access request, payment migrations |
| supabase/functions/ | Access intake, Turnstile, Razorpay Edge Functions |
| functions/api/ | Cloudflare Pages Functions: contact and privacy-request |
| public/ | SEO files, fonts, logos, favicons, share images and headers |
| scripts/ | Production preflight, route, secret, DB, dependency and favicon checks |
| tests/isolation.test.mjs | Isolation, payment and legal-parity regression checks |
| docs/legal/ | Data inventory, privacy request, incident and retention runbooks |
| docs/ | Deployment, security, SEO and audit documentation |

### Routes

Public English: /, /technologies/, /digital/, /commerce/, /about/, /case-studies/, /contact/, /faq/, /review/, /privacy/, /privacy/requests/, /terms/, /cookies/, /accessibility/, /quote/confirmed/, /404.html.

Hindi equivalents live under /hi/: home, technologies, digital, commerce, about, case studies, contact, FAQ, review, privacy/request desk, terms, cookies, accessibility, quote confirmation and 404.

Integrated portal: /portal/, /portal/login/, /portal/logout/, /portal/orders/, /portal/invoices/, /portal/files/, /portal/messages/, /portal/support/, /portal/admin/, /portal/404/.

portal/dist is a separate build with routes at its own root. Do not deploy it at the primary domain root unintentionally; the integrated path is /portal/ on the main domain.

---

## 4. Forms, auth, data and payments

### Contact and quote inquiry

Public pages: /contact/ and /hi/contact/. Turnstile is checked by server code before relay. Backend functions/api/contact.ts is a Cloudflare Pages Function and is designed to fail closed if email relay is not configured; it should never show fake success. Relay names documented include WEB3FORMS_ACCESS_KEY and FORMSPREE_KEY; check current function precedence before configuring both. Use a designated test mailbox for QA.

### Privacy request desk

Pages: /privacy/requests/ and /hi/privacy/requests/. Backend functions/api/privacy-request.ts is a Cloudflare Pages Function. Source/tests record origin/referrer checks, payload limit, honeypot and relay behavior. Follow docs/legal/PRIVACY_REQUEST_RUNBOOK.md. A form does not itself ensure legal response timelines.

### Client access request

- Schema migration: supabase/migrations/20261028000000_client_access_requests.sql.
- Edge Function: supabase/functions/request-client-access/index.ts.
- Deployment notes: supabase/functions/request-client-access/README.md.
- Turnstile plus server-side write using service role to a private table with RLS and no browser grants/policies.
- Concurrent pending requests are deduplicated by normalized email.
- Configure exact ALLOWED_ORIGINS and production Turnstile domains/keys.
- Requests stay pending; the form is not an approval system.

### Supabase Auth and portal data

Auth helper code exists in src/lib/portal/ and portal/src/lib/. OTP request should remain shouldCreateUser: false and verification uses email OTP type. Configure Supabase redirect URLs narrowly to the actual portal return paths. Keep public self-registration off if invite-only is required. User reports the production email flow works; dashboard configuration was not independently inspected. Historical README/flow docs may contain obsolete host/timer details; use current code and dashboard.

Migrations cover profiles/roles, orders, order events, files, invoices, payments, messages, support tickets/responses, notifications and audit logs. RLS is the tenant isolation boundary. Apply migrations in order; do not edit an already-applied migration, use a forward migration. Older docs describe 60-second signed file links; verify active helper/runtime before making a duration promise. Local tests do not prove the live DB is configured.

### Payment flow

1. Browser requests an order through create-razorpay-order.
2. Edge Function uses an atomic database procedure to assign/reuse an invoice order.
3. Razorpay Checkout returns payment identifiers and signature.
4. verify-razorpay-payment checks the HMAC then finalizes payment in the DB.
5. razorpay-webhook verifies Razorpay signature and handles events idempotently.

The live path depends on deployed SQL functions, Supabase secrets, Razorpay live/test mode, webhook endpoint/events/secrets, and database state. Test only with nonproduction data and Razorpay test mode. Never perform real charges as a smoke test.

---

## 5. SEO, language, images and trust

- astro.config.mjs sets canonical base https://strovagroups.in. Confirm www/apex redirects with the actual host.
- src/components/SEOHead.astro supplies title, description, canonical, bilingual hreflang, Open Graph/Twitter tags, favicons and optional JSON-LD.
- Sitemap excludes /portal/. robots.txt blocks private portal/API paths.
- public/llms.txt gives a concise site map for answer-engine discovery.
- Logo: public/images/logo.svg and public/images/brand/. Favicons: public/favicon-strova.*. Social card: public/images/og-strova-group.png plus SVG source.
- English/Hindi pages are separate; common strings are in src/data/i18n.ts.
- src/data/credentials.ts suppresses profile claims without a verifiable URL.
- Do not invent customers, results, awards, locations or launches. No SEO/AEO/GEO score or ranking can be guaranteed; improve discoverability through factual, readable, technically accessible content and accurate structured data.

---

## 6. Hosting and deployment

Repository deployment guidance favors Cloudflare Pages because:

- functions/api/* and public/_headers are Cloudflare Pages conventions.
- Supabase Edge Functions run on Supabase regardless of frontend host.
- Root dist/ contains public pages and integrated /portal/ routes.

Vercel can serve static files, and Supabase functions still work there. However, Cloudflare Pages functions and _headers are not automatically translated into Vercel functions/headers. docs/DEPLOYMENT_ARCHITECTURE.md says privacy API needs Vercel adaptation/proxy. Verify the actual production provider and domain in the owner's account; repository files do not prove the live host.

### Useful npm commands

- npm ci — deterministic dependency installation.
- npm run dev — local site.
- npm run build:all — root site and separate portal builds.
- npm run preview — local static preview.
- npm test — isolation/security regression tests.
- npm run astro:check — Astro diagnostics.
- npm run verify:routes — built assets, links and local routes; also attempts remote HTTPS checks.
- npm run scan:secrets — tracked files/build output scan.
- npm run verify:favicons — generated favicon validation.
- npm run audit:deps — dependency audit.
- npm run verify:db — migration/privilege checks without live connection.
- npm run verify:db:live — needs private DATABASE_URL.
- npm run preflight:prod — checks production config; requires real values in environment.

---

## 7. Environment variables (names only; no values)

Do not copy secrets into this document, commits, browser code or reports. Store private values in the proper provider secret manager. .env files should stay ignored.

### Public build-time (browser-visible; not secrets)

PUBLIC_SITE_URL, PUBLIC_PORTAL_URL, PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY (public key protected by RLS), PUBLIC_TURNSTILE_SITE_KEY, PUBLIC_RAZORPAY_KEY_ID (public ID only). Optional public verification/social values include PUBLIC_GOOGLE_SITE_VERIFICATION, PUBLIC_BING_SITE_VERIFICATION, PUBLIC_GOOGLE_REVIEW_URL, PUBLIC_LINKEDIN_URL, PUBLIC_GITHUB_URL, PUBLIC_INSTAGRAM_URL, PUBLIC_YOUTUBE_URL, PUBLIC_GOOGLE_BUSINESS_URL and PUBLIC_CLUTCH_URL.

### Private Cloudflare function values

TURNSTILE_SECRET_KEY, WEB3FORMS_ACCESS_KEY and/or FORMSPREE_KEY, plus function-specific origin/environment configuration.

### Private Supabase function/database values

SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TURNSTILE_SECRET_KEY where needed, ALLOWED_ORIGINS for access intake, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, PORTAL_SIGNING_SECRET where the active code uses it, and DATABASE_URL only for trusted DB verification.

docs/ENVIRONMENT_VARIABLES.md, .env.example and functions are historical snapshots and not perfectly synchronized. Verify consumers and correct runtime before setting anything. The presence of a variable name in a template does not prove it is deployed. Never bundle service-role, payment, Turnstile-secret or database credentials. Rotate any secret ever committed/exposed.

---

## 8. Security, privacy, accessibility and performance

Code contains form validation/bot checks, invite-only OTP, RLS migrations, payment signature checks, idempotent webhook handling, fail-closed relay logic, security header files, portal noindex handling and privacy/accessibility/legal pages. Headers only work if the chosen host applies _headers or equivalent configuration. Self-hosted fonts and a hero fallback exist; browser performance must still be measured.

This document does not certify compliance with the DPDP Act, GDPR, WCAG, or other laws/standards. Actual data processing, notice/lawful basis, retention/deletion, processor contracts, grievance handling, incident response and cross-border processing need review by responsible operators and qualified counsel. Automated tests cannot prove live security, provider configuration, real email delivery, every browser/screen-reader behavior, or SLA performance.

The homepage states custom code/IP ownership transfers after final settlement. Ensure contract text, third-party/open-source exclusions, pre-existing materials and actual handover process support that statement. Do not promise 24-hour support unless the team can consistently meet it.

---

## 9. Validation performed for this handoff

Ran locally on 29 October 2026:

| Check | Result | Meaning |
|---|---|---|
| npm run build:all | PASS: root build 42 pages; separate portal build 10 pages | Static generation succeeds; not a deployment/live integration test |
| npm test | PASS: 259 assertions, 0 failed | Deterministic repository regression suite; not live penetration test |
| npm run verify:routes | PASS locally: 2,192 passed, 0 failed | Built links/assets/local HTTP paths pass; remote HTTPS not verified |
| npm run scan:secrets | PASS: 212 tracked files plus both builds, no detected leaks | Scanner result, not proof of absence |
| npm run astro:check | PASS: 0 errors, 0 warnings, 69 hints | Hints include unused items/deprecations |
| npm run preflight:prod | FAIL in local environment | No production variables supplied here |

Preflight reports local missing values for Supabase URL/anon key, service role, Razorpay ID/secret/webhook, Turnstile site/secret keys and form relay. This does not show whether production dashboards have them; dashboards were not accessed.

Remote URL checks returned UNVERIFIED due UNABLE_TO_VERIFY_LEAF_SIGNATURE from this runner. No live form submission, OTP login, access request, admin action, database privilege connection, Razorpay test payment/webhook, or real viewport browser QA was conducted for this handoff. OTP working is user-reported. No deployment was performed.

---

## 10. Work still needed for an unqualified READY verdict

1. Run production preflight in a trusted release environment with actual values securely provided; verify correct runtime and no secret in bundles.
2. Confirm all nine migrations are applied in the intended Supabase project; deploy current Edge Functions; inspect live RLS, storage privacy, secrets and invocation settings. Use verify:db:live only with private DB access.
3. Confirm actual host (Cloudflare Pages or Vercel), www/apex redirects, security headers/CSP/HSTS, cache/rewrites and the execution of API functions. Adapt functions/api and headers if Vercel is actual host.
4. Test OTP redirect, Turnstile, inquiry/privacy relay, access-request persistence and Razorpay test mode using test accounts/project only.
5. Define a trusted process for reviewing pending Client Hub applications; the website has no integrated approval queue.
6. Do desktop/tablet/mobile browser QA, keyboard/focus and reduced-motion checks, console review, hero fallback/performance check.
7. Finish copy alignment to Strova Group → Strova Technology → Digital | Automation | Products; identify Products as planned unless already launched.
8. Reconcile old README and dated deployment/environment/portal/audit docs; they disagree on brand, host and flow details.
9. Obtain legal/operator review of notices, retention, processor agreements, grievance and incident handling, and contractual IP language.
10. Verify error monitoring/alerts, backups/restore owner, incident contact and rollback target. The repository does not prove monitoring is configured.

### Deployment assessment

**READY WITH LIMITATIONS.** Local build and repository QA pass, but production readiness is not established: local production preflight fails without provider values, remote TLS checks are unverified, and live dashboards/database/integrations were not independently checked. This does not prove the live site is broken. A full READY verdict requires evidence from actual hosting and Supabase accounts.

---

## 11. Suggested release runbook

1. Confirm production host, canonical domain behavior, and release SHA.
2. Configure variables in correct provider secret stores. Keep private values out of browser builds.
3. Apply migrations to staging; verify RLS, RPC privileges, and private storage.
4. Deploy Supabase functions with exact secrets and origin allowlist.
5. Test Supabase redirect allowlist, OTP template/delivery, invite-only behavior using test mailbox.
6. Configure Turnstile domains and site/secret pair; test public forms.
7. Test inquiry/privacy relays with authorized test mailbox.
8. Test Razorpay in test mode against nonproduction DB; verify webhook and invoice settlement.
9. Run preflight, both builds, tests, diagnostics, route checks, secret scan and dependency audit.
10. Deploy only after external checks pass; this document is not deployment authorization.
11. Smoke test HTTPS routes, headers, portal permissions, metadata, forms and callbacks.
12. Record SHA, deployment build, migration version, rollback target; monitor after release.

## 12. Handoff notes

- Revision 5673f56594d55a3126cd12768902baa9eb251078 was clean on main when inspected.
- Source code and provider configuration remain the truth; this document is a map.
- Before changes inspect status/branch/diff and preserve unrelated work.
- Use forward migrations; never test against real customer data or charge real funds.
- Distinguish local tests, user-reported checks, and externally verified evidence.
- No commit, push, merge or production deploy was made for this handoff document.

---

## 13. Follow-on premium showcase and performance pass (29 October 2026)

The follow-on work replaces the homepage's three unstyled CSS mockups with six locally served, hand-authored SVG interface concepts in the existing brand palette: business website, customer portal, e-commerce storefront, workflow automation, SaaS workspace, and mobile customer experience. These are presented in English and Hindi and are explicitly identified as illustrative concepts, not customer work. Assets are lazy-loaded and include intrinsic width/height and descriptive alt text. No client outcomes or case studies were invented.

The decorative full-screen SVG turbulence/noise overlay was removed, hero title reveal no longer animates a blur filter, scroll-progress updates are coalesced to one update per animation frame, the nonessential IST status refresh interval was reduced from 15 to 60 seconds, and the decorative monogram is omitted on narrow screens to keep the mobile hero compact. All six SVGs are hand-authored vector UI illustrations, not AI-generated photos; the built-in image-generation capability was unavailable in the authoring session.

Validation performed locally for this follow-on pass: `npm run build:all` succeeded (42 marketing routes and 10 portal routes); `npm test` passed 259/259; `npm run astro:check` reported 0 errors and 0 warnings (69 hints); `npm run scan:secrets` found no exposed credentials across 212 tracked files and both build outputs; `npm run verify:routes` passed 2,220 checks; `npm run verify:favicons` passed 70 checks; `npm run audit:deps` found zero dependency vulnerabilities; `npm run audit` reported 0 errors and 0 warnings; `npm run verify:db` passed 10 static checks and skipped live database verification because no database URL was configured; `npm run preflight -- --mode=test` passed in test mode. Browser QA was performed at 390 × 844, with an earlier 820 × 1000 and desktop inspection: the mobile hero and showcase rendered, all six local SVGs loaded with descriptive alt text, the document did not overflow horizontally, and the browser reported no console errors. Local image generation tools were unavailable; the six portfolio visuals are original hand-authored SVG interface concepts rather than generated photography.

The deployment preflight, live database privileges, payment-provider callbacks, and other production credentials were not verified against live production systems in this pass. CI's protected production release gate requires those external checks and is separate from ordinary source CI. No production deployment was performed.
