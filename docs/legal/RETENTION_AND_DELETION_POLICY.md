# Strova Group — Data Retention & Deletion Policy

**Organization:** Strova Group (Proprietorship of Babita Kumari)  
**Classification:** Internal Data Governance & Operational Standard  
**Effective Date:** October 14, 2026  
**Review Frequency:** Annual  

---

## 1. Principles of Storage Limitation & Statutory Compliance

Under the Digital Personal Data Protection Act, 2023 ("DPDP Act") and general principles of data minimization:
1. Personal data shall be retained **only for as long as necessary** to satisfy the specific lawful purpose for which it was collected.
2. Once the processing purpose is fulfilled, or upon the withdrawal of consent, personal data must be permanently erased or anonymized, **unless retention is necessary for compliance with any law for the time being in force**.

---

## 2. Standard Retention Schedules by Data Classification

| Classification Tier | Data Categories Included | Standard Retention Duration | Governing Statutory Authority / Business Justification | Automated or Manual Purge Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Statutory Financial & Tax Records** | Invoices, Payment Receipts, GST transaction ledgers, Razorpay Payment IDs, customer billing addresses. | **7 Years (84 Months)** from the end of the relevant financial year. | **CGST Act, 2017 (Sec 36)**; **Income Tax Act, 1961 (Sec 44AA)**; Companies Act norms for commercial bookkeeping. | **Legal Hold Active**: Immutable storage in `public.invoices` and `public.payments`. Records cannot be deleted by user request until the statutory period lapses. |
| **Tier 2: Contractual Deliverables & Engagement Records** | Executed Statements of Work, Milestone Signoff Records, Technical Blueprints, Repository Handover Receipts. | **Active Engagement + 7 Years** post-delivery. | **Limitation Act, 1963** (Statutory period for commercial contract and breach claims in India). | Transferred to offline cold archive after 12 months; permanently purged after 7 years via administrative audit. |
| **Tier 3: Inactive Inquiries & Prospect Data** | Contact form submissions, quote requests, exploratory emails, and project scoping notes that did not proceed to contract. | **12 Months** from date of receipt. | Legitimate business evaluation; allowing prospect to resume inquiry within reasonable seasonal window. | Semi-annual purge cycle: all unmatched submissions older than 365 days are permanently deleted from email and database logs. |
| **Tier 4: Support Tickets & Functional Warranty Records** | Support requests, bug reports, remediation notes under the 30-day functional warranty. | **3 Years** from ticket resolution. | Tracking recurring technical defects; defending against post-warranty performance disputes. | Automated database cleanup script targeting closed tickets older than 36 months. |
| **Tier 5: Privacy Requests & Compliance Records** | Privacy rights requests, identity verification confirmations, consent withdrawal logs, and grievance resolution letters. | **3 Years** from resolution date. | Regulatory compliance proof under DPDP Act 2023 for inspection by the Data Protection Board of India. | Purged after 36 months from the internal compliance register. |
| **Tier 6: Ephemeral Credentials & Security Telemetry** | Authentication OTP codes, Cloudflare Turnstile tokens, private download signed URLs, edge firewall logs. | - **OTP Codes**: 10 minutes.<br>- **Signed URLs**: 60 seconds.<br>- **Edge Logs**: 90 days rolling buffer.<br>- **Analytics Events**: 30 days. | Preventing replay attacks, credential stuffing, and session hijacking; real-time DDoS mitigation. | - Supabase Auth expires OTPs automatically after 600s.<br>- Signed download URLs become cryptographically invalid after 60s.<br>- Cloudflare rotates edge logs on a rolling 90-day FIFO buffer. |

---

## 3. Legal Hold Procedure

In the event that Strova Group receives a formal summons, legal notice, commercial dispute notice, or tax audit inquiry:
1. The proprietor shall immediately issue an internal **Legal Hold Notice** specifying the records, accounts, or clients involved.
2. Any automated or scheduled deletion routines affecting the specified records are immediately suspended.
3. The hold remains active until formal resolution of the proceeding, after which standard retention rules resume.

---

## 4. Secure Deletion & Disposal Standards

When personal data reaches the end of its designated retention period:
1. **Database Records**: Executed via SQL `DELETE` with cascading cleanup of foreign-key dependencies in the PostgreSQL database.
2. **Cloud Storage Deliverables**: Executed via S3 API object deletion, ensuring no residual object versions or public CDN caches remain.
3. **Email Submissions**: Hard deletion of message threads from the business mail server and trash purge.
4. **Physical Media**: Strova Group operates on a paperless cloud infrastructure; any incidental physical documentation containing personal data is destroyed using cross-cut shredding.
