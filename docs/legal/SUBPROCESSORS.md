# Strova Group — Authoritative Subprocessor Register

**Organization:** Strova Group (Proprietorship of Babita Kumari)  
**Classification:** Public Technical & Vendor Compliance Register  
**Effective Date:** October 14, 2026  
**Review Frequency:** Quarterly  

---

## 1. Third-Party Infrastructure & Service Providers

Strova Group engages the following verified subprocessors and third-party infrastructure providers to operate the marketing website, client portal, and payment checkout systems:

| Subprocessor / Entity | Service Purpose | Headquarters / Jurisdiction | Data Categories Processed | Cross-Border Safeguards & Certifications | Privacy Documentation Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Cloudflare, Inc.** | Edge CDN, DNS routing, Web Application Firewall (WAF), Cloudflare Pages static hosting, Pages Functions, Turnstile bot verification. | San Francisco, California, USA (Global edge network). | Anonymized IP addresses, HTTP request headers, User-Agent, edge telemetry, Turnstile challenge tokens. | SOC 2 Type II, ISO 27001, PCI-DSS Level 1, Standard Contractual Clauses (SCCs), Cloudflare DPA. | [Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/) |
| **Supabase, Inc.** | Managed PostgreSQL database hosting, Supabase Auth (passwordless email OTP), Supabase Storage (private S3 deliverables), Edge Functions. | San Francisco, CA, USA (AWS cloud regions, including Mumbai `ap-south-1`). | Client account email, profile name, company, order milestones, order messages, invoice metadata, deliverable file metadata, audit log. | SOC 2 Type II, AES-256 encryption at rest, TLS 1.3 in transit, strict Row Level Security (RLS) policies, Supabase DPA. | [Supabase Privacy Policy](https://supabase.com/privacy) |
| **Razorpay Software Private Limited** | Indian payment aggregator & payment gateway (UPI, Netbanking, Cards, Wallets). | Bengaluru, Karnataka, India. | Invoice number, transaction amount (paise), currency, client email, phone number, gateway order ID, gateway payment ID. | Reserve Bank of India (RBI) authorized payment aggregator; PCI-DSS Level 1 certified; data localized in India pursuant to RBI directives. | [Razorpay Privacy Policy](https://razorpay.com/privacy/) |
| **Transactional Email Relay (Web3Forms / Formspree / Custom SMTP)** | Secure transit relay for inbound quote forms from website to business inbox (`info@strovagroups.in`). | USA / Germany. | Inquirer name, email, company name, phone/WhatsApp (optional), project specification text. | Encrypted TLS transmission; transit-only processing without secondary monetization or persistent profiling. | [Web3Forms Privacy](https://web3forms.com/privacy) |
| **Meta Platforms, Inc. / WhatsApp Ireland Limited** | Optional direct communications channel initiated voluntarily by client via official WhatsApp link (`+91 92880 77802`). | Menlo Park, CA, USA / Dublin, Ireland. | Client telephone number, WhatsApp profile name, chat messages. | End-to-end encryption across WhatsApp protocol; communication initiated strictly at client's election. | [WhatsApp Privacy Policy](https://www.whatsapp.com/legal/privacy-policy) |

---

## 2. Artificial Intelligence & Machine Learning Subprocessor Disclosures

When Strova Group delivers AI, WhatsApp automation, or custom language model integration services for a client (Strova Technologies division):
1. **No Foundational Training on Client Data**: Strova Group does not submit client proprietary code, internal business data, or customer records to public foundational model training pipelines.
2. **Dedicated API Endpoints**: Third-party commercial AI APIs (e.g. OpenAI API, Anthropic API, or Google Cloud Vertex AI) are engaged strictly under enterprise API terms that legally prohibit model training on submitted API inputs/outputs.
3. **Data Minimization**: In engineering automation workflows, personal identifiers are redacted or masked prior to processing by external language model inference endpoints wherever technically feasible.

---

## 3. Subprocessor Change Notification Procedure

1. Strova Group maintains this register in the public repository and updates it upon engaging any new subprocessor.
2. Active enterprise clients with executed DPAs may subscribe to notification updates by contacting `info@strovagroups.in`.
3. Clients retain the right to object to any new subprocessor on reasonable data protection grounds within fourteen (14) days of publication.

