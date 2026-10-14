# Strova Group — Personal Data Incident & Breach Response Procedure

**Organization:** Strova Group (Proprietorship of Babita Kumari)  
**Classification:** Internal Cybersecurity & Data Protection Incident Procedure  
**Effective Date:** October 14, 2026  
**Governing Frameworks:** Digital Personal Data Protection Act, 2023 (Sec 8(6)); CERT-In Cyber Security Directions (28 April 2022); GDPR (Art 33/34)  

---

## 1. Incident Definition & Triggers

A **Personal Data Breach** is any confirmed or reasonably suspected security incident leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or unauthorized access to personal data transmitted, stored, or otherwise processed by Strova Group or its cloud subprocessors.

**Common Triggers:**
- Unauthorized administrative access to the Supabase database.
- Compromised infrastructure credentials or leaked Edge Function secrets.
- Accidental disclosure of confidential client deliverables or source repositories.
- Ransomware or malware infection affecting development workstations.
- Exploitation of an unpatched zero-day vulnerability in web application dependencies.

---

## 2. 5-Phase Incident Lifecycle

```
[Phase 1: Detection & Triage]
       │
       ▼
[Phase 2: Immediate Containment] (Rotate keys, isolate workers, block malicious IPs)
       │
       ▼
[Phase 3: Forensic Investigation & Risk Assessment]
       │
       ▼
[Phase 4: Statutory Notification & Communications] (DPB, CERT-In, Clients within 48h)
       │
       ▼
[Phase 5: Post-Incident Hardening & Audit]
```

### Phase 1: Detection, Alerting & Triage (Hour 0 – Hour 2)
1. **Immediate Escalation**: Any team member or engineer discovering an anomaly must immediately notify the Incident Lead via emergency telephone / private channel.
2. **Initial Severity Triage**:
   - **Low**: Isolated scanning attempt blocked by WAF; no data accessed.
   - **Medium**: Limited account credential compromise with zero database exfiltration.
   - **High / Critical**: Confirmed unauthorized access to `public.profiles`, `invoices`, or client private files.

### Phase 2: Containment & Evidence Preservation (Hour 2 – Hour 6)
1. **Credential Rotation**:
   - Immediately rotate all Supabase service role keys, database passwords, Razorpay secrets, and Turnstile secrets in production dashboards.
   - Invalidate all active Supabase Auth sessions by revoking refresh tokens.
2. **Access Isolation**:
   - Apply Cloudflare WAF IP blocks to offending addresses or autonomous systems.
   - If a specific Edge Function is compromised, temporarily disable the function endpoint.
3. **Forensic Evidence Preservation**:
   - Export and seal Cloudflare firewall event logs, Supabase database query logs, and git commit history with cryptographic timestamps. Never overwrite or wipe log files during investigation.

### Phase 3: Investigation & Impact Assessment (Hour 6 – Hour 24)
1. Determine the exact root cause, entry vector, and timeframe of compromise.
2. Inventory all affected data records: identify specific Data Principals, clients, and categories of data involved (e.g. contact details vs financial records).
3. Evaluate the likelihood of harm, identity theft, or financial loss to affected individuals.

### Phase 4: Statutory Notifications & Client Communication (Hour 24 – Hour 72)

#### A. Notification to the Data Protection Board of India (DPB)
- **Mandate**: Section 8(6) of the DPDP Act 2023 requires the Data Fiduciary to give intimation of personal data breach to the Board and to each affected Data Principal.
- **Timing**: Upon confirmation of breach, submit notification in prescribed form without undue delay.
- **Content**: Description of the incident, estimated number of affected principals, nature of data involved, consequences, and mitigating actions taken.

#### B. Notification to Affected Clients (under DPA)
- **Mandate**: Clause 7 of the Strova Group DPA.
- **Timing**: In writing within **48 hours** of breach confirmation.
- **Action**: Provide affected B2B clients with technical details so they may notify their own downstream users if required.

#### C. CERT-In Cyber Incident Reporting (Where Applicable)
- **Mandate**: CERT-In Directions 2022 require reporting of specified cybersecurity incidents (such as unauthorized access to IT systems, ransomware, or identity theft) within **6 hours** of notice to `incident@cert-in.org.in`.
- **Assessment**: If the incident falls within the 20 mandatory reporting categories under CERT-In guidelines, submit the initial report within the 6-hour window.

### Phase 5: Post-Mortem, Remediation & Governance (Day 4 – Day 14)
1. Conduct a root-cause retrospective review with engineering and management.
2. Implement permanent technical hardening (e.g. updating firewall rules, adding automated tests, tightening RLS policies).
3. Document the final incident report and retain it in the compliance archive for **five (5) years**.

