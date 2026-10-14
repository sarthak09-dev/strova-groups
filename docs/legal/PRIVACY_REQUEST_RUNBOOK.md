# Strova Group — Data Principal Privacy Request & Grievance Runbook

**Organization:** Strova Group (Proprietorship of Babita Kumari)  
**Classification:** Internal Operational Runbook / SOP  
**Target Roles:** Grievance Officer, Operations Lead, Database Administrator  
**Effective Date:** October 14, 2026  
**Governing Laws:** Digital Personal Data Protection Act, 2023 (Sec 11–14); GDPR (Art 12–22)  

---

## 1. Intake Channels & Tracking System

1. **Digital Intake**: Web form at `https://strovagroups.in/privacy/requests/` (and Hindi route `https://strovagroups.in/hi/privacy/requests/`).
2. **Email Intake**: Direct inquiries to `info@strovagroups.in` with subject containing "Privacy", "DPDP", or "Grievance".
3. **Reference Identification**: Every incoming request must immediately be logged with a unique tracking reference:
   `PR-[YYYYMM]-[4-DIGIT-HEX]` (e.g., `PR-202610-A4B2`).

---

## 2. Step-by-Step Fulfillment Workflow

```
[Step 1: Intake & Logging]
       │
       ▼
[Step 2: Identity Verification] (Email confirmation; no government ID requested)
       │
       ▼
[Step 3: Request Classification] (Access, Correction, Erasure, Withdrawal, Grievance)
       │
       ▼
[Step 4: Statutory Exception Check] (Tax 7-year hold, ongoing contract, active dispute)
       │
       ▼
[Step 5: Operational Execution] (Export data / Update DB / Purge non-statutory records)
       │
       ▼
[Step 6: Written Notice & Log Archival] (Resolution email within 30 days; 3-year audit record)
```

### Step 1: Statutory Acknowledgment (Within 48 Hours)
- Send an automated or direct written acknowledgment to the requester's email.
- State:
  - Unique tracking reference ID.
  - Date and time received.
  - Target statutory resolution timeline (**30 calendar days**).
  - Designated contact: Grievance Desk (`info@strovagroups.in`).

### Step 2: Identity Verification & Proportionality
- **Rule of Proportionality**: Never demand government identity documents (Aadhaar, Passport, PAN) for simple inquiries or email list unsubscribes.
- Verification is accomplished by sending a verification challenge or confirmation link to the email address associated with the records.
- If the requester is an authorized representative or nominee, obtain written proof of nomination or authority.

### Step 3: Request Classification & Execution Protocols

#### A. Right to Access (Information Summary)
1. Query Supabase PostgreSQL database for matching `profiles`, `orders`, `messages`, `invoices`, and `files` records.
2. Query quote form historical logs for matching email submissions.
3. Prepare a clear, readable summary document detailing:
   - Categories of personal data held.
   - Processing purposes.
   - List of third-party subprocessors sharing or hosting data.
4. Transmit summary to requester via secure encrypted email.

#### B. Right to Correction / Updating
1. Review submitted updates against active project contracts.
2. If correcting client organization details, verify that the requester is the authorized account holder.
3. Update `public.profiles` or relevant order records.
4. Notify any relevant subprocessors if data was propagated.

#### C. Right to Erasure / Deletion & Lawful Holds
1. **Mandatory Statutory Exception Check**:
   - **Financial & Tax Records**: Invoices, receipts, and payment references in `public.invoices` and `public.payments` **CANNOT** be erased prior to seven (7) years under the Central Goods and Services Tax (CGST) Act 2017 (Sec 36) and Income Tax Act 1961.
   - **Active Engagements**: Data required for an ongoing project in progress cannot be erased without terminating the commercial contract.
   - **Security Telemetry**: Edge security logs retained for bot mitigation and CERT-In compliance cannot be selectively deleted.
2. **Eligible for Erasure**:
   - Non-converted quote inquiries older than 30 days.
   - Marketing email records or communication preferences.
   - Closed project accounts where statutory tax retention periods have expired.
3. Execute deletion in Supabase database and purge local backups.
4. Document the exact records erased and provide written confirmation citing any records retained under statutory hold.

#### D. Consent Withdrawal
1. If the requester previously opted in to optional communications, immediately suppress the email address in communication tools.
2. Confirm that withdrawal does not affect processing conducted prior to withdrawal.

#### E. Nomination (DPDP Act Sec 14)
1. Record the nominated individual's name, email, and relationship in the client account record.
2. Verify that in the event of death or incapacity, the nominee may exercise the Data Principal's statutory rights.

#### F. Grievance & Escalation
1. If the submission is a grievance or complaint regarding privacy practices, assign it directly to the designated Grievance Officer.
2. Investigate the factual circumstances, consult legal guidance if required, and formulate a corrective action plan.
3. Provide a detailed written response within **30 calendar days**.
4. Inform the Data Principal that if they are dissatisfied with the resolution, they have the statutory right to escalate the grievance to the **Data Protection Board of India**.

---

## 3. Compliance Log & Audit Trail

1. Record each request in the internal `privacy_requests_log`:
   - Reference ID, Date Received, Requester Email (hashed or masked after closure), Request Type, Outcome (Fulfilled / Partially Fulfilled / Rejected with Legal Grounds), Date Completed, Handling Officer.
2. Maintain compliance logs for a minimum of **three (3) years** to demonstrate compliance during any regulatory audit by the Data Protection Board.

