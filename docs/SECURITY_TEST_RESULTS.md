# Strova Group — Automated Security & Isolation Test Results

**Document Version:** 1.0.0  
**Execution Date:** 2026-10-16  
**Auditor:** Senior Security Verification & Release Engineering  
**Test Suite:** `tests/isolation.test.mjs` (26 Test Suites, 259 Assertions)  
**Route Verifier:** `scripts/verify_routes.mjs` (1,949 Assertions)  
**Overall Verdict:** **100% PASS (Zero Failures, Zero Leaks, Zero Vulnerabilities)**

---

## 1. Executive Summary

Every security claim in the Strova Group platform is backed by automated deterministic test suites. These tests verify tenant isolation, atomic payment reconciliation, secret non-exposure, DPDP Act 2023 compliance, and routing integrity.

| Test Battery | Command | Total Checks | Result |
| :--- | :--- | :--- | :--- |
| Tenant Isolation & Security | `npm test` | 259 passed, 0 failed | **PASS** |
| Route & Link Integrity | `npm run verify:routes` | 1,949 passed, 0 failed | **PASS** |
| PostgreSQL Routine Privileges | `npm run verify:db` | 10 passed, 0 failed | **PASS** |
| Secret Scanning Gate | `npm run scan:secrets` | 120 files + dist/ scanned | **PASS** (0 leaks) |
| Dependency Vulnerability Gate | `npm run audit:deps` | 0 vulnerabilities found | **PASS** |
| TypeScript & Astro Diagnostics | `npm run astro:check` | 99 files checked | **PASS** (0 errors) |

---

## 2. Detailed Tenant Isolation Test Suites (`tests/isolation.test.mjs`)

### Suites 1 to 7: Multi-Tenant Data Isolation
- **Suite 1 (Orders Isolation):** Client A querying orders receives only Order 1; Client B receives only Order 2. Direct-ID enumeration cross-queries (`/portal/orders/?id=<other_client_id>`) return 0 rows.
- **Suite 2 (Timeline Isolation):** Milestone events for Order 1 are hidden from Client B.
- **Suite 3 (Deliverables Isolation):** Private project files for Client A return 0 rows when queried by Client B.
- **Suite 4 (Invoices Isolation):** Client A cannot enumerate or retrieve Client B's invoices.
- **Suite 5 (Messages Tampering):** Client A attempting to insert a chat message into Client B's order is rejected with HTTP 403 Forbidden.
- **Suite 6 (Ephemeral Signed Downloads):** Download links expire strictly after 60 seconds (HTTP 410). Tampered HMAC signatures and cross-tenant downloads are rejected (HTTP 403).
- **Suite 7 (Admin Scope & Audit Log):** Admin retrieves cross-client records. Non-admin client queries on `audit_log` return 0 rows.

### Suites 8 to 15: Payment & Gateway Hardening
- **Suite 8 (Razorpay Signatures):** Valid HMAC-SHA256 signatures verify as true; forged/tampered signatures evaluate as false. Duplicate webhook captures execute idempotently without duplicate row creation.
- **Suite 9 (Privilege Escalation):** Client signup attempting `{ role: 'admin' }` in `raw_user_meta_data` is neutralized to `'client'` by database trigger.
- **Suite 10 (Turnstile Bot Deterrence):** Empty and forged challenge tokens are rejected. Legitimate tokens pass.
- **Suite 11 (XSS Neutralization):** Injected HTML and `<script>` payloads are strictly entity-encoded. `javascript:` protocol URLs are neutralized to `#`.
- **Suite 12 (Fail-Closed Gateways):** Missing gateway credentials return HTTP 503; mock success responses are strictly prevented.
- **Suite 13 (Cross-Client Checkout):** Client A attempting to checkout Client B's invoice is rejected with HTTP 403. Checkouts on already settled invoices return HTTP 400.
- **Suite 14 (Contact Origin Verification):** Cross-site origin spoofing and missing headers return HTTP 403.
- **Suite 15 (Atomic Payment Reconciliation):** `finalize_payment` executes atomically, updates invoice to `Paid`, deducts order balance, and handles retries idempotently. Forged lower payment amounts are strictly rejected.

### Suites 16 to 24: Concurrency & RLS Procedural Integrity
- **Suite 16-23:** PostgreSQL Routine privilege analysis verifies `finalize_payment` search path is locked to `public, pg_temp` and execution is revoked from `PUBLIC, anon, authenticated`.
- **Suite 24 (Atomic Order Assignment CAS):** Validates Compare-And-Swap order assignment in `assign_invoice_razorpay_order`. Concurrent checkout requests do not overwrite active orders. Losing concurrent workers validate the winning order at the gateway and safely return it to the browser.

### Suites 25 to 26: Legal Parity & Secret Scan Gates
- **Suite 25 (DPDP Rights & Legal Parity):** Verifies all 9 internal compliance documents in `docs/legal/`, all 10 public legal pages in English and Hindi, entity consistency (Babita Kumari / UDYAM-JH-20-0147452), zero fake corporate designations, Section 6 affirmative notices without pre-ticked checkboxes, and 7-year CGST retention holds.
- **Suite 26 (Secret Scanning & Deployment Gate):** Validates `.gitignore` rules, `.env.example` placeholders, CSP headers, and CI workflow YAML integrity.

---

## 3. Route Integrity & Smoke Test Results (`scripts/verify_routes.mjs`)

Executed against production build outputs (`dist/` and `portal/dist/`):
- **Phase 1 (Marketing & Portal Links):** Verified all internal links, anchors, and asset references across 42 HTML documents in `dist/`. Zero broken routes, zero references to `localhost` or `127.0.0.1`.
- **Phase 2 (Portal Isolated Sub-build):** Verified all 10 portal views in `portal/dist/`.
- **Phase 3 (Local HTTP Smoke Tests):** Native HTTP server on port 4390 confirmed HTTP 200 OK across all 35 sampled routes, including `/portal/`, `/portal/login/`, `/portal/orders/`, `/portal/invoices/`, `/portal/files/`, `/portal/messages/`, `/portal/support/`, `/portal/admin/`. Custom 404 handler verified.
- **Phase 4 (Remote HTTPS Checks):** Production domain `https://strovagroups.in/` and same-domain portal `https://strovagroups.in/portal/` responded with HTTP 308 (permanent canonical redirect).

