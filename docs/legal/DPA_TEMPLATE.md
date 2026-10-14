# Data Processing Addendum (DPA) Template

**Between:**  
1. **The Client** (as identified in the applicable Statement of Work or Service Agreement), acting as **Data Fiduciary / Data Controller**; and  
2. **Strova Group** (Proprietorship of Babita Kumari, UDYAM-JH-20-0147452), having its principal place of business in India, acting as **Data Processor / Service Provider**.

*(Collectively referred to as the "Parties" and individually as a "Party".)*

---

## 1. Scope, Context & Purpose

1.1. This Data Processing Addendum ("DPA") supplements the master commercial agreement or Statement of Work ("SOW") executed between the Parties for custom software development, digital marketing, or automation services.  
1.2. This DPA applies whenever Strova Group processes Personal Data on behalf of the Client in the performance of its contractual engineering and maintenance obligations.  
1.3. For the purposes of India's Digital Personal Data Protection Act, 2023 ("DPDP Act") and the European Union General Data Protection Regulation ("GDPR"), the Client is the **Data Fiduciary / Controller**, and Strova Group is the **Data Processor**.

---

## 2. Documented Instructions & Purpose Limitation

2.1. Strova Group shall process Personal Data strictly in accordance with the documented, written instructions of the Client (including as set forth in the applicable SOW), and solely for the purpose of delivering, testing, deploying, or supporting the contracted software or digital infrastructure.  
2.2. Strova Group shall not sell, rent, monetize, disclose, or process Client Personal Data for its own commercial purposes or for the purpose of training public foundational artificial intelligence models, unless expressly agreed upon in a signed addendum.  
2.3. If Strova Group is required by applicable Indian or international law to process Personal Data outside the Client's instructions, it shall promptly inform the Client before doing so, unless prohibited by law on public interest grounds.

---

## 3. Confidentiality & Personnel Governance

3.1. Strova Group shall ensure that any personnel authorized to process Client Personal Data (including senior software engineers and database administrators) are subject to written confidentiality obligations.  
3.2. Access to Client production databases and data pipelines is restricted on a strict need-to-know basis using role-based access control (RBAC).

---

## 4. Technical and Organizational Security Safeguards

4.1. Strova Group maintains robust technical safeguards appropriate to the risk of processing, including:
- **Encryption**: Enforcing TLS 1.3 / 1.2 in transit across all web APIs and databases; applying AES-256 encryption at rest for cloud databases.
- **Access Control**: Multi-factor authentication (MFA) on all infrastructure access accounts; zero hardcoded credentials in source code.
- **Data Isolation**: Logical separation of tenant data via PostgreSQL Row Level Security (RLS) policies.
- **Vulnerability Remediation**: Automated dependency vulnerability scanning prior to code deployment.

---

## 5. Subprocessor Management

5.1. The Client acknowledges and agrees that Strova Group engages verified third-party infrastructure providers ("Subprocessors") to host and operate cloud services:
- **Cloudflare, Inc.**: Global edge CDN, DDoS mitigation, and worker execution.
- **Supabase, Inc.**: Managed cloud PostgreSQL database and authentication engine.
- **Razorpay Software Private Limited**: Indian payment gateway processing.  
5.2. Strova Group shall impose data protection obligations on any Subprocessor that are no less protective than those set forth in this DPA.  
5.3. Strova Group shall inform the Client of any intended changes or additions to its Subprocessors, providing the Client a reasonable opportunity to object on demonstrable data security grounds.

---

## 6. Assistance with Data Principal Rights

6.1. Taking into account the nature of the processing, Strova Group shall provide reasonable assistance to the Client, through appropriate technical and organizational measures, to enable the Client to fulfill its statutory obligations to respond to Data Principal requests (such as requests for access, correction, erasure, or consent withdrawal under the DPDP Act or GDPR).  
6.2. If Strova Group receives a request directly from a Data Principal concerning Client data, it shall promptly forward the request to the Client without responding directly, unless instructed otherwise.

---

## 7. Personal Data Breach Notification

7.1. In the event of a confirmed Personal Data Breach affecting Client data under Strova Group's custody, Strova Group shall notify the Client in writing without undue delay (and in any case within **48 hours** of becoming aware of the breach).  
7.2. The notification shall describe:
- The nature of the breach and categories of records affected.
- Likely consequences and potential risks.
- Mitigating measures taken or proposed to contain the incident.  
7.3. Strova Group shall cooperate reasonably with the Client in fulfilling any statutory breach reporting obligations to regulatory authorities (such as the Data Protection Board of India or CERT-In) or affected Data Principals.

---

## 8. Data Return and Deletion

8.1. Upon termination or expiration of the engineering engagement, Strova Group shall, at the Client's written election, securely return or permanently delete all Client Personal Data, copies, and staging databases within **30 calendar days**, except where retention is mandated by applicable tax, commercial, or statutory record-keeping laws.

---

## 9. International Data Transfers

9.1. Where processing involves the transfer of Personal Data originating from the European Economic Area (EEA), United Kingdom, or Switzerland to India or third-party cloud data centers, the Parties agree to incorporate the European Commission's standard contractual clauses ("SCCs") or UK International Data Transfer Addendum by reference.

---

## 10. Governing Law & Dispute Resolution

10.1. This DPA shall be governed by and construed in accordance with the laws governing the principal Statement of Work, or in the absence of an explicit choice, the laws of the Republic of India, subject to the jurisdiction of competent courts at the domicile of Strova Group.
