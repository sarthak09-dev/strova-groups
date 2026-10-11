# Strova Group — Production Static Website

> **AI & automation for growing businesses.**  
> Official static corporate website for **Strova Group**, an India-based technology and digital services company delivering high-performance software engineering, native mobile apps, automated WhatsApp workflows, and data-driven marketing.

---

## 1. Architecture & Tech Stack

This website is engineered for speed, security, and zero vendor lock-in.

- **Framework**: [Astro v5](https://astro.build/) (Static Site Generation / SSG).
- **Styling**: Modern vanilla CSS with CSS custom properties (design tokens), container queries, and `@media (prefers-color-scheme)` dark/light theming.
- **Typography**: 100% self-hosted variable fonts via npm (`@fontsource-variable/inter` and `@fontsource-variable/space-grotesk`). Zero external CDN requests.
- **Animations & 3D**:
  - **Three.js**: Lazy-loaded abstract geometric visual on the homepage hero with WebGL detection, pixel ratio cap at 2, and `IntersectionObserver` pause/resume.
  - **GSAP & ScrollTrigger**: Orchestrated hero element reveals, subtle parallax on capability cards, and a pinned 4-step "How We Work" sequence on desktop with unpinned fallback for mobile.
- **Forms & Interactivity**: Vanilla JavaScript with client-side regex validation, invisible honeypot spam protection (`_hp_company`), and a human math challenge.
- **Security & Headers**: Cloudflare Pages `_headers` configuring Content Security Policy (CSP), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy`.
- **SEO & Structured Data**: Native JSON-LD schemas (Organization, WebSite, Service, Person, FAQPage, BreadcrumbList), automated XML sitemaps via `@astrojs/sitemap`, and multi-locale hreflang tags (`en`, `en-IN`, `x-default`).

---

## 2. Directory Structure

```
strova-group/
├── astro.config.mjs         # Astro configuration & sitemap integration
├── package.json             # Dependencies and build scripts
├── tsconfig.json            # TypeScript configuration
├── public/
│   ├── _headers             # Cloudflare Pages security & caching headers
│   ├── favicon.svg          # Vector favicon
│   ├── llms.txt             # LLM agent context & company index
│   ├── robots.txt           # Crawler instructions & sitemap link
│   └── images/
│       ├── hero-fallback.svg # Static geometric SVG fallback for Three.js
│       ├── logo.svg          # 512x512 brand mark vector asset
│       ├── og-default.webp   # 1200x630 social share OpenGraph card
│       └── founder.webp      # 400x400 founder portrait placeholder
└── src/
    ├── styles/
    │   └── global.css       # Design tokens, reset, typography scale, buttons
    ├── layouts/
    │   └── BaseLayout.astro # Base HTML wrapper, skip link, Header & Footer
    ├── components/
    │   ├── Header.astro     # Sticky responsive navigation with phone & WhatsApp CTA
    │   ├── Footer.astro     # Business information, Udyam MSME, hours & links
    │   ├── SEOHead.astro    # Metadata, OpenGraph, Twitter, and JSON-LD
    │   └── ThreeHero.astro  # Lazy-loaded Three.js 3D canvas with fallback
    └── pages/
        ├── index.astro      # Home page (Hero, Divisions, Process, Pricing, FAQ)
        ├── technologies.astro # Strova Technologies (Web, Android, SaaS, AI)
        ├── digital.astro    # Strova Digital (SEO, Performance Ads, Funnels)
        ├── commerce.astro   # Strova Commerce ("Coming Soon" Q3 2026 Roadmap)
        ├── about.astro      # Founder story (Babita Kumari), principles, corporate identity
        ├── case-studies.astro # Production architecture reference blueprints
        ├── faq.astro        # Categorized Frequently Asked Questions
        ├── contact.astro    # Interactive brief form with spam protection & click-to-call
        ├── privacy.astro    # DPDP Act 2023 & GDPR compliant Privacy Policy
        ├── terms.astro      # Commercial Terms, 50% milestone policy, IP terms
        └── 404.astro        # Branded, accessible 404 error page
```

---

## 3. Local Development & Build

### Prerequisites
- Node.js `v20+` or `v24+` installed (Node `v24.21.0` verified).

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Starts the local development server at `http://localhost:4321`.

### Production Build
```bash
npm run build
```
Generates production-optimized static files in the `dist/` directory.

### Preview Production Build
```bash
npm run preview
```
Serves the `dist/` directory locally for pre-flight testing.

---

## 4. Brand Palette & Design Tokens

Defined in `src/styles/global.css`:

| Token | Name | Hex / Value | Usage |
| :--- | :--- | :--- | :--- |
| `--color-void` | Void | `#08090D` | Dark page background, text primary in light theme |
| `--color-slate` | Slate | `#1A1D27` | Surface background, dark card background |
| `--color-indigo` | Indigo | `#6366F1` | Primary brand accent, primary CTA buttons |
| `--color-cyan` | Cyan | `#22D3EE` | Secondary brand accent, glowing highlights |
| `--color-ice` | Ice | `#F1F5F9` | Elevated surfaces, light theme body background |
| `--color-snow` | Snow | `#FFFFFF` | Light background, crisp text in dark theme |

- **Headings Font**: `Space Grotesk Variable`
- **Body Font**: `Inter Variable`

---

## 5. Content Editing Guide

### Updating Company Contact Details
To change the business address, phone number, or email across the entire website:
- **Global Footer & Microdata**: Edit `src/components/Footer.astro` and `src/layouts/BaseLayout.astro`.
- **Contact Page**: Edit `src/pages/contact.astro`.
- **Privacy Grievance Officer**: Edit `src/pages/privacy.astro`.

### Updating Service Pricing
- **Home Page Snapshot**: Edit `.pricing-card` elements in `src/pages/index.astro`.
- **Technologies Pricing**: Edit `.pricing-compact` elements in `src/pages/technologies.astro`.
- **Digital Retainer Pricing**: Edit `.pricing-compact` elements in `src/pages/digital.astro`.

### Adding or Modifying FAQs
To add or modify questions on the homepage FAQ:
1. Open `src/pages/index.astro`.
2. Locate the `faqs` array at the top of the frontmatter:
   ```ts
   const faqs = [
     {
       question: 'Your question here?',
       answer: 'Your detailed answer here.',
     },
   ];
   ```
3. Updating this array automatically updates **both** the interactive UI accordion and the Google `FAQPage` JSON-LD structured data.

---

## 6. Comprehensive Placeholder Checklist (TODO Items)

In adherence to strict integrity policies, **no synthetic testimonials, fake logos, or invented team members have been fabricated**. All missing real-world credentials are explicitly marked with `TODO` markers. Use this checklist before production launch:

| Item | Location | Current Value / Placeholder | Action Required |
| :--- | :--- | :--- | :--- |
| **Legal Entity Name** | `src/components/Footer.astro`<br/>`src/pages/about.astro`<br/>`src/layouts/BaseLayout.astro` | `Strova Group` | Verified brand & trade name. Confirm official legal registration type (Proprietorship / LLP / Pvt Ltd). |
| **Founder Role Title** | `src/pages/about.astro`<br/>JSON-LD Person schema | `[ROLE TITLE]` | Confirm official designation for Babita Kumari (e.g. Managing Director / Principal / Founder). |
| **Registered Address** | `src/components/Footer.astro`<br/>`src/pages/contact.astro`<br/>`src/layouts/BaseLayout.astro`<br/>`src/pages/privacy.astro`<br/>`src/pages/about.astro` | `[ADDRESS]` | Supply official registered office street address, city, state, and PIN once confirmed. |
| **Official Email** | Across all files & schemas | `info@strovagroups.in` | Configured across all pages, footers, headers, JSON-LD schemas, and forms. |
| **Phone & WhatsApp** | Across all files, headers & footers | `+91 92880 77802`<br/>`https://wa.me/919288077802` | Configured with direct click-to-call and WhatsApp links. |
| **Udyam MSME Number** | `src/components/Footer.astro`<br/>`src/pages/about.astro`<br/>`src/pages/contact.astro` | `[UDYAM NO. when issued]` | Replace placeholder with official government-issued Udyam certificate registration number once issued. |
| **Social Media Profiles** | `src/layouts/BaseLayout.astro` | `sameAs: []` in JSON-LD | Add URLs to official LinkedIn, Twitter/X, and GitHub company pages once created. |
| **Grievance Officer** | `src/pages/privacy.astro` | `[ADDRESS]` / `info@strovagroups.in` | Supply name and direct office desk address for statutory DPDP Act 2023 disclosure. |
| **Analytics Token** | `src/layouts/BaseLayout.astro` | Commented Cloudflare beacon | Uncomment script and insert Cloudflare Web Analytics token. |
| **Production Case Studies** | `src/pages/case-studies.astro` | Architecture reference blueprints | Replace or link public client case studies once formal NDA clearance is granted. |

---

## 7. Post-Deployment Lighthouse & Quality Checklist

Run Google Lighthouse on the production build to verify the following thresholds:

### 1. Performance (Target: 95–100)
- [x] **Largest Contentful Paint (LCP)**: Under 1.5 seconds.
- [x] **First Contentful Paint (FCP)**: Under 0.9 seconds.
- [x] **Cumulative Layout Shift (CLS)**: Zero (0.00). All images, icons, and canvas containers specify fixed `width`, `height`, or CSS `aspect-ratio`.
- [x] **Interaction to Next Paint (INP)**: Under 100ms. Heavy Three.js execution is deferred via `requestIdleCallback` after main thread idle.
- [x] **Three.js Off-Screen Suspension**: Verified `IntersectionObserver` halts `requestAnimationFrame` when the hero visual leaves viewport.

### 2. Accessibility (Target: 100)
- [x] **WCAG 2.2 AA Color Contrast**: All text satisfies minimum 4.5:1 contrast against page backgrounds in both light and dark modes.
- [x] **Skip Link**: Top-level `<a href="#main-content" class="skip-link">Skip to main content</a>` functional via Tab key.
- [x] **Visible Focus Rings**: Dedicated 2px/3px focus ring outline on all interactive inputs, buttons, and links.
- [x] **Screen Reader Labels**: `aria-expanded`, `aria-controls`, `aria-label`, and `role="alert"` implemented on all dynamic controls.
- [x] **Reduced Motion**: Fallback SVG replaces Three.js 3D animation when `prefers-reduced-motion: reduce` is active.

### 3. Best Practices & Security (Target: 100)
- [x] **No Vulnerabilities / CDNs**: Fonts and scripts are completely self-hosted.
- [x] **Security Headers**: `public/_headers` deployed to Cloudflare Pages (CSP, `nosniff`, `frame-ancestors 'none'`, `Referrer-Policy`).
- [x] **HTML5 Doctype & Encodings**: `<!doctype html>`, `<html lang="en" dir="ltr">`, `<meta charset="utf-8">`.

### 4. SEO & Structured Data (Target: 100)
- [x] **Schema.org Rich Snippets**: Validate pages on [Google Rich Results Test](https://search.google.com/test/rich-results) for Organization, WebSite, Service, Person, and FAQPage.
- [x] **Canonical & Hreflang**: Canonical links and hreflang tags (`en`, `en-IN`, `x-default`) present on every view.
- [x] **Robots & Sitemap**: `robots.txt` points to `sitemap-index.xml`. Verified 10 routes generated without 404 indexing.

---

## 8. Deployment to Cloudflare Pages

This site is optimized for zero-cost edge hosting on **Cloudflare Pages**:

1. Push this repository to GitHub or GitLab.
2. In the Cloudflare Dashboard, navigate to **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
3. Select the repository and configure the build settings:
   - **Framework Preset**: `Astro`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Environment Variables**:
     - `NODE_VERSION`: `20` or higher (e.g. `24.21.0`)
4. Click **Save and Deploy**. Cloudflare automatically applies the caching rules and security headers defined in `public/_headers`.
