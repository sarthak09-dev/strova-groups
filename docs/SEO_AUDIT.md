# Strova Group — Technical SEO, Structured Data & AI Discoverability Audit

**Document Version:** 1.0.0  
**Audit Date:** 2026-10-16  
**Auditor:** Technical SEO & Web Performance Specialist  
**Canonical Domain:** `https://strovagroups.in`  
**Sitemap Index:** `https://strovagroups.in/sitemap-index.xml`  
**AI Crawlers Policy:** `https://strovagroups.in/robots.txt` + `https://strovagroups.in/llms.txt`

---

## 1. Technical SEO Strategy & Indexation Architecture

Strova Group's SEO strategy is white-hat, answer-first, and intent-focused. The marketing website serves as the primary organic discovery channel for businesses in India and internationally seeking custom software, website engineering, and business automation.

### Architecture Principles:
1. **Strict Canonicalization:** All public pages output with trailing slashes matching `trailingSlash: 'always'` in `astro.config.mjs` and canonical tags pointing to `https://strovagroups.in/...`.
2. **Bilingual Parity:** Full English (`/`) and Hindi (`/hi/`) versions with bi-directional `hreflang` alternate links on all routes.
3. **Private Route Protection:** Private portal views (`/portal/*`) and API endpoints (`/api/*`) are strictly excluded from search engines via:
   - `public/robots.txt`: `Disallow: /portal/` and `Disallow: /api/`
   - Scoped `<meta name="robots" content="noindex, nofollow, noarchive" />` in `PortalLayout.astro`
   - `@astrojs/sitemap` integration filter: `filter: (page) => !page.includes('/portal/')`
   - HTTP Header `Cache-Control: private, no-cache, no-store, must-revalidate`

---

## 2. Page-Level Metadata & On-Page SEO Audit

| Route | Canonical URL | Title Tag (< 60 chars) | Meta Description (< 160 chars) | H1 Heading | Schema Types |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | `https://strovagroups.in/` | Strova Group — High-Performance Websites & Custom Web Apps | High-performance websites, custom web apps, and business automations engineered in India. Built for speed, conversions, and security. | High-performance websites & custom web applications. | `Organization`, `WebSite`, `BreadcrumbList` |
| `/technologies/` | `https://strovagroups.in/technologies/` | Custom Web Applications & Portal Development — Strova Group | Bespoke web apps, client portals, and WhatsApp automation engineered for growing businesses. Transparent scopes, fixed milestones, zero fluff. | Engineered web applications, client portals, and automation. | `Service`, `BreadcrumbList` |
| `/digital/` | `https://strovagroups.in/digital/` | Technical SEO & Performance Optimization — Strova Group | Technical SEO audits, Core Web Vitals remediation, and data-driven organic growth. Built for speed, indexability, and measurable search rankings. | Technical SEO, speed optimization, and search discovery. | `Service`, `BreadcrumbList` |
| `/commerce/` | `https://strovagroups.in/commerce/` | Digital Commerce Solutions — Strova Group | High-conversion headless commerce and custom transaction workflows. Built for reliable payments and checkout performance. | Digital commerce architecture & payment workflows. | `Service`, `BreadcrumbList` |
| `/about/` | `https://strovagroups.in/about/` | About Strova Group — Founder Story & Commercial Principles | Independent digital engineering firm founded by Babita Kumari in Jharkhand, India. Registered MSME delivering reliable software. | Independent digital engineering rooted in technical discipline. | `Organization`, `Person`, `BreadcrumbList` |
| `/case-studies/`| `https://strovagroups.in/case-studies/`| Technical Case Studies & Architectural Deep Dives | Architectural deep dives and measurable case studies in custom web engineering, performance optimization, and workflow automation. | Architectural case studies & verifiable deliverables. | `CollectionPage`, `BreadcrumbList` |
| `/contact/` | `https://strovagroups.in/contact/` | Contact Strova Group — Inquire About Your Project | Discuss your website development, custom web app, or technical SEO project with Strova Group. Fixed scopes, clear timelines, prompt response. | Discuss your project with our engineering team. | `ContactPage`, `BreadcrumbList` |
| `/faq/` | `https://strovagroups.in/faq/` | Frequently Asked Questions — Strova Group | Clear answers regarding project scopes, 50% milestone payments, delivery timelines, maintenance support, and intellectual property. | Commercial, technical, and operational questions answered. | `FAQPage`, `BreadcrumbList` |
| `/privacy/` | `https://strovagroups.in/privacy/` | Privacy Policy — Strova Group (DPDP Act 2023 Compliant) | Comprehensive privacy policy explaining personal data processing, DPDP Act 2023 compliance, zero marketing trackers, and client data rights. | Privacy Policy & Data Protection Principles. | `Article`, `BreadcrumbList` |
| `/terms/` | `https://strovagroups.in/terms/` | Terms of Service — Strova Group | Commercial terms of service governing website design, custom software deliverables, 50% milestone payments, and intellectual property transfer. | Commercial Terms of Service & Client Engagement. | `Article`, `BreadcrumbList` |
| `/cookies/` | `https://strovagroups.in/cookies/` | Cookie Policy — Strova Group | Transparent cookie policy. Zero advertising or tracking cookies on marketing pages; strictly necessary authentication cookies only in portal. | Transparent Cookie Policy. | `Article`, `BreadcrumbList` |
| `/accessibility/`| `https://strovagroups.in/accessibility/`| Accessibility Statement — WCAG 2.2 AA Compliance | Digital accessibility statement outlining our commitment to WCAG 2.2 AA standards across websites, semantic markup, and client applications. | Digital Accessibility Commitment. | `Article`, `BreadcrumbList` |

*(All 16 Hindi `/hi/` routes mirror this metadata with verified Hindi translations).*

---

## 3. Commercial Keyword & Search Intent Mapping

| Core Service Topic | Search Intent | Target Queries (India & International) | Dedicated Content Section |
| :--- | :--- | :--- | :--- |
| Custom Web Applications | Commercial Investigation | "custom web application development india", "operational business dashboard developer", "bespoke internal portal development" | `/technologies/` (Capabilities, Tech Stack, Milestones) |
| High-Speed Websites | Commercial / Transactional | "high performance website development", "astro js web developer india", "fast business website for clinics" | `/technologies/` + Homepage |
| Website Modernization | Problem Solving | "website redesign services for business", "legacy website modernization", "slow wordpress website rebuild" | `/technologies/` + Case Studies |
| Technical SEO | Informational / Commercial | "core web vitals optimization service", "technical seo audit india", "website crawlability and indexation fix" | `/digital/` (Remediation Framework) |
| WhatsApp & Workflow Automation | Transactional | "whatsapp cloud api integration for business", "automated lead booking workflow", "custom business automation india" | `/technologies/` (Automation Architecture) |

---

## 4. Structured Data (JSON-LD) Validation

All structured data is generated dynamically via semantic components and validated against Schema.org:

1. **`Organization` Schema:**
   - Legal Name: `Babita Kumari (Operating as Strova Group)`
   - Brand Name: `Strova Group`
   - URL: `https://strovagroups.in`
   - Email: `info@strovagroups.in`
   - Telephone: `+91-92880-77802`
   - Registration: `UDYAM-JH-20-0147452` (Micro enterprise sole proprietorship)
2. **`WebSite` Schema:**
   - Defines site URL and search action potential.
3. **`Service` Schemas:**
   - Dedicated service definitions on `/technologies/`, `/digital/`, and `/commerce/`.
   - Clear starting price ranges (INR with USD on request) and verifiable turnaround timelines.
4. **`Person` Schema (Founder):**
   - Visible on `/about/`: Babita Kumari, Founder & Proprietor.
5. **`BreadcrumbList` Schema:**
   - Hierarchical trail on every inner page, facilitating breadcrumb snippets in search engine result pages (SERPs).

---

## 5. AI Search & Discoverability Standards

Modern search engines (Google AI Overviews, Perplexity AI, ChatGPT Search, Bing Copilot) ingest structured, crawlable factual text:

### 5.1 LLM Citation File (`public/llms.txt`)
A structured markdown guide detailing:
- Brand identity, legal entity status, and registered MSME details.
- Primary services, technologies utilized (Astro, TypeScript, Supabase, PostgreSQL, Cloudflare, Razorpay).
- Founder identity and commercial payment policies (50% deposit, fixed milestones).
- Verified canonical URLs.

### 5.2 AI Crawler Permissions (`public/robots.txt`)
- Explicitly **Allows** legitimate search and retrieval bots:
  - `OAI-SearchBot`
  - `ChatGPT-User`
  - `PerplexityBot`
  - `ClaudeBot`
  - `GPTBot`
  - `Applebot-Extended`
- Explicitly **Disallows** access to private portal dashboards and APIs (`Disallow: /portal/`, `Disallow: /api/`).

---

## 6. Core Web Vitals & Performance Benchmark

- **Largest Contentful Paint (LCP):** < 1.8s (Static HTML generation, pre-warmed Google variable fonts, optimized SVG icons, deferred 3D WebGL hero).
- **Cumulative Layout Shift (CLS):** 0.00 (Explicit dimensions on all images, zero late-injected dynamic banners, system font fallbacks).
- **Interaction to Next Paint (INP):** < 50ms (Zero heavy client hydration frameworks on marketing pages; vanilla JavaScript for navigation and accordion components).
- **Bundle Weight:** Total initial marketing JS is under 40KB gzipped (excluding the optional, deferred Three.js module).

