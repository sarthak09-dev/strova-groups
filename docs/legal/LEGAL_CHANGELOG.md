# Strova Group — Legal & Compliance Version Control Changelog

**Organization:** Strova Group (Proprietorship of Babita Kumari)  
**Classification:** Versioned Compliance History  
**Repository:** `https://github.com/sarthak09-dev/strova-groups`  

---

## Policy Version History

### Version 2.0.0 — October 14, 2026 (Comprehensive DPDP & Compliance Overhaul)
- **Privacy Policy**:
  - Rewritten completely from real implementation: mapped all 10 data categories across marketing site and client portal.
  - Formally differentiated Strova's role as Data Fiduciary (own operations) vs Data Processor (client custom software).
  - Explicitly aligned with India's **Digital Personal Data Protection Act, 2023** and **DPDP Rules, 2025**.
  - Detailed Data Principal statutory rights (Access, Correction, Erasure, Consent Withdrawal, Nomination under Sec 14, Grievance Redressal).
  - Established concrete 7-year tax retention rule, 12-month inquiry retention, and 90-day edge log rolling buffers.
  - Linked to new dedicated Privacy Rights & Grievance desk.
- **Privacy Rights Request Portal**:
  - Implemented `/privacy/requests/` and `/hi/privacy/requests/` with backend API `functions/api/privacy-request.ts`.
  - Added anti-abuse honeypot, Turnstile bot verification, Origin checking, and automated reference ID generation (`PR-YYYYMM-XXXX`).
  - Implemented 48-hour statutory acknowledgment and 30-day resolution timeline.
- **Terms of Service**:
  - Accurately identified legal entity as *Strova Group (Proprietorship of Babita Kumari)*, MSME registration UDYAM-JH-20-0147452.
  - Codified 50% commitment advance / 50% milestone settlement framework with 100% unencumbered code transfer upon full payment.
  - Added 30-day functional warranty, reasonable disclaimers, and clear cancellation/refund policies.
  - Included comprehensive nominative fair use disclaimers for third-party marks (Google, Meta, Cloudflare, Razorpay, Supabase).
  - Enforced AI & automation data protection: zero public model training on client proprietary code.
- **Cookie & Storage Policy**:
  - Re-audited and verified zero tracking/advertising cookies on marketing website.
  - Transparently disclosed essential portal authentication tokens and transient Razorpay payment modal storage.
- **Client Portal Legal Integration**:
  - Added direct legal links in PortalLayout sidebar footer and login card footer.
- **Internal Compliance Suite**:
  - Created `docs/legal/` containing Applicability Matrix, Data Inventory, Gaps Report, DPA Template, Subprocessors Register, Privacy Request Runbook, Incident Response Plan, and Retention Policy.

---

### Version 1.1.0 — October 13, 2026 (Permanent White Theme & Portal Security)
- Updated commercial policies to reflect permanent light-first design architecture.
- Added MSME Udyam registration disclosure (`UDYAM-JH-20-0147452`).
- Standardized billing policy disclaimers and 8-stage project timeline transparency.

---

### Version 1.0.0 — October 12, 2026 (Initial Baseline)
- Initial publication of website Terms of Service and Privacy Policy outline.

---

## Mandatory Future Review Triggers

The legal policies and internal documentation must be formally reviewed upon any of the following triggers:
1. **Statutory Commencement**: Official notification by the Ministry of Electronics and Information Technology (MeitY) of any new rules, operational guidelines, or enforcement dates under the DPDP Act.
2. **Subprocessor Alteration**: Any change or addition to cloud infrastructure, database hosting, payment aggregation, or email relay vendors.
3. **New Commercial Division**: Launch of the Strova Commerce division or introduction of any consumer-facing retail transactions.
4. **Periodic Audit**: Scheduled bi-annual review (Next review: **April 14, 2027**).
