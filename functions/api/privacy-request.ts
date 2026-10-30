/**
 * Cloudflare Pages Function: /api/privacy-request
 * Handles Data Principal Privacy Rights & Grievance Requests under:
 * - India Digital Personal Data Protection Act, 2023 (DPDP Act) & DPDP Rules, 2025
 * - Information Technology (SPDI) Rules, 2011 & Consumer Protection E-Commerce Rules, 2020
 * - Conditional International Frameworks (GDPR Art 15-22, UK GDPR, CCPA/CPRA, etc.)
 *
 * Security & Reliability Controls:
 * - 64KB strict body size guard
 * - Origin & Referer verification against authorized domains
 * - In-memory IP rate limiting (5 submissions per 10 minutes)
 * - Cloudflare Turnstile bot verification (mandatory & fail-closed in production)
 * - Anti-bot honeypot field (_hp_website)
 * - Structured PR-YYYYMM-XXXX reference tracking generation
 * - Bilingual response messages (English & Hindi)
 * - Optional notification dispatch to grievance desk relay
 */

interface Env {
  ENVIRONMENT?: string;
  TURNSTILE_SECRET_KEY?: string;
  CONTACT_API_KEY?: string;
  WEB3FORMS_ACCESS_KEY?: string;
  FORMSPREE_KEY?: string;
}

// In-memory rate limiting map for edge worker instance
const rateLimitMap = new Map<string, { count: number; firstSeen: number }>();

const MAX_BODY_BYTES = 64 * 1024; // 64KB
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

const VALID_REQUEST_TYPES = new Set([
  'access',
  'correction',
  'erasure',
  'consent_withdrawal',
  'marketing_optout',
  'nomination',
  'grievance',
]);

function generateTrackingId(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const randomBytes = new Uint8Array(2);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `PR-${year}${month}-${randomHex}`;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const requestId = crypto.randomUUID();
  try {
    const request = context.request;
    const isTestEnv = context.env.ENVIRONMENT === 'test';

    // 1. Strict Payload Size Check
    const contentLengthHeader = request.headers.get('content-length');
    if (contentLengthHeader) {
      const cl = parseInt(contentLengthHeader, 10);
      if (!isNaN(cl) && cl > MAX_BODY_BYTES) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Request payload exceeds maximum allowed size of 64KB.',
          }),
          { status: 413, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const bodyText = await request.text();
    if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Request payload exceeds maximum allowed size of 64KB.',
        }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Strict Origin & Referer Verification
    const originHeader = request.headers.get('origin');
    const refererHeader = request.headers.get('referer');
    const allowedHostnames = new Set([
      'strovagroups.in',
      'www.strovagroups.in',
      'portal.strovagroups.in',
      'localhost',
      '127.0.0.1',
    ]);

    let requestHostname: string | null = null;

    if (originHeader) {
      try {
        requestHostname = new URL(originHeader).hostname.toLowerCase();
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: 'Malformed Origin header.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else if (refererHeader) {
      try {
        requestHostname = new URL(refererHeader).hostname.toLowerCase();
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: 'Malformed Referer header.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!requestHostname || (!allowedHostnames.has(requestHostname) && !requestHostname.endsWith('.vercel.app'))) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized request origin.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. IP Rate Limiting (max 5 requests per 10 minutes per IP)
    const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown-ip';
    const now = Date.now();
    const rateWindow = 10 * 60 * 1000;
    const ipRecord = rateLimitMap.get(clientIp);

    const remainingQuota = ipRecord ? Math.max(0, 5 - ipRecord.count) : 5;
    const resetSeconds = ipRecord ? Math.ceil((rateWindow - (now - ipRecord.firstSeen)) / 1000) : 600;

    const rateLimitHeaders: Record<string, string> = {
      'RateLimit-Limit': '5',
      'RateLimit-Remaining': String(remainingQuota),
      'RateLimit-Reset': String(resetSeconds),
    };

    if (ipRecord) {
      if (now - ipRecord.firstSeen < rateWindow) {
        if (ipRecord.count >= 5) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Rate limit exceeded. Please wait a few minutes before submitting another request or contact info@strovagroups.in directly.',
            }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(resetSeconds),
                ...rateLimitHeaders,
              },
            }
          );
        }
        ipRecord.count++;
      } else {
        rateLimitMap.set(clientIp, { count: 1, firstSeen: now });
      }
    } else {
      rateLimitMap.set(clientIp, { count: 1, firstSeen: now });
    }

    // Clean up stale rate limit entries
    if (rateLimitMap.size > 1000) {
      for (const [ip, entry] of rateLimitMap.entries()) {
        if (now - entry.firstSeen > rateWindow) rateLimitMap.delete(ip);
      }
    }

    // 4. Content-Type Parsing
    const contentType = request.headers.get('content-type') || '';
    let payload: Record<string, string> = {};

    if (contentType.includes('application/json')) {
      try {
        payload = JSON.parse(bodyText);
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: 'Malformed JSON payload.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
        );
      }
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const searchParams = new URLSearchParams(bodyText);
      searchParams.forEach((val, key) => {
        payload[key] = val;
      });
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Unsupported Content-Type header.' }),
        { status: 415, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
      );
    }

    // Language selector
    const lang = (payload.lang || '').toLowerCase() === 'hi' ? 'hi' : 'en';
    const t = (en: string, hi: string) => (lang === 'hi' ? hi : en);

    // 5. Anti-Bot Honeypot
    const honeypot = (payload._hp_website || '').trim();
    if (honeypot) {
      return new Response(
        JSON.stringify({
          success: false,
          error: t('Automated request rejected.', 'स्वचालित अनुरोध अस्वीकृत।'),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
      );
    }

    // 6. Field Extraction & Strict Validation
    const name = (payload.name || '').trim();
    const email = (payload.email || '').trim();
    const phone = (payload.phone || '').trim();
    const requestType = (payload.requestType || '').trim().toLowerCase();
    const details = (payload.details || '').trim();
    const relationship = (payload.relationship || '').trim();
    const turnstileToken = (payload['cf-turnstile-response'] || '').trim();

    if (!name || name.length < 2 || name.length > 100) {
      return new Response(
        JSON.stringify({
          success: false,
          error: t('Please provide your full legal name (2 to 100 characters).', 'कृपया अपना पूरा नाम प्रदान करें (2 से 100 वर्ण)।'),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email) || email.length > 120) {
      return new Response(
        JSON.stringify({
          success: false,
          error: t('Please provide a valid email address (max 120 characters).', 'कृपया एक मान्य ईमेल पता प्रदान करें (अधिकतम 120 वर्ण)।'),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
      );
    }

    if (phone.length > 30) {
      return new Response(
        JSON.stringify({
          success: false,
          error: t('Phone number must not exceed 30 characters.', 'फ़ोन नंबर 30 वर्णों से अधिक नहीं होना चाहिए।'),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
      );
    }

    if (!requestType || !VALID_REQUEST_TYPES.has(requestType)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: t(
            'Please select a valid privacy request type (access, correction, erasure, consent_withdrawal, marketing_optout, nomination, grievance).',
            'कृपया एक मान्य गोपनीयता अनुरोध प्रकार चुनें (access, correction, erasure, consent_withdrawal, marketing_optout, nomination, grievance)।'
          ),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
      );
    }

    if (!details || details.length < 10 || details.length > 3000) {
      return new Response(
        JSON.stringify({
          success: false,
          error: t(
            'Please describe your request in detail (between 10 and 3,000 characters).',
            'कृपया अपने अनुरोध का विस्तृत विवरण दें (10 से 3,000 वर्णों के बीच)।'
          ),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
      );
    }

    if (relationship.length > 120) {
      return new Response(
        JSON.stringify({
          success: false,
          error: t('Relationship description must not exceed 120 characters.', 'संबंध विवरण 120 वर्णों से अधिक नहीं होना चाहिए।'),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
      );
    }

    // 7. Cloudflare Turnstile Verification
    const turnstileSecret = context.env.TURNSTILE_SECRET_KEY;

    if (!turnstileSecret && !isTestEnv) {
      return new Response(
        JSON.stringify({
          success: false,
          error: t(
            'Security verification service is unconfigured. Please email your privacy request directly to info@strovagroups.in.',
            'सुरक्षा सत्यापन सेवा कॉन्फ़िगर नहीं है। कृपया अपना गोपनीयता अनुरोध सीधे info@strovagroups.in पर भेजें।'
          ),
        }),
        { status: 503, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
      );
    }

    if (turnstileSecret || !isTestEnv) {
      if (!turnstileToken) {
        return new Response(
          JSON.stringify({
            success: false,
            error: t(
              'Security verification token missing. Please complete the verification challenge.',
              'सुरक्षा सत्यापन टोकन अनुपलब्ध है। कृपया सत्यापन चुनौती पूरी करें।'
            ),
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
        );
      }

      const turnstileFormData = new FormData();
      turnstileFormData.append('secret', turnstileSecret || '');
      turnstileFormData.append('response', turnstileToken);
      turnstileFormData.append('remoteip', clientIp);

      try {
        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body: turnstileFormData,
          signal: AbortSignal.timeout(5000),
        });

        const outcome = (await verifyRes.json()) as { success?: boolean; hostname?: string; action?: string; 'error-codes'?: string[] };

        if (!verifyRes.ok || !outcome.success || outcome.hostname !== requestHostname || outcome.action !== 'privacy-request') {
          return new Response(
            JSON.stringify({
              success: false,
              error: t(
                'Security verification failed. Please refresh and try again.',
                'सुरक्षा सत्यापन विफल रहा। कृपया पृष्ठ को रीफ़्रेश करें और पुनः प्रयास करें।'
              ),
            }),
            { status: 403, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
          );
        }
      } catch (err) {
        return new Response(
          JSON.stringify({
            success: false,
            error: t(
              'Unable to verify security challenge at this time. Please try again or email info@strovagroups.in.',
              'सुरक्षा सत्यापन पूरा करने में असमर्थ। कृपया पुनः प्रयास करें या info@strovagroups.in पर ईमेल करें।'
            ),
          }),
          { status: 502, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
        );
      }
    }

    // 8. Forward to the configured relay. A reference is issued only after acceptance.
    const web3formsKey = context.env.WEB3FORMS_ACCESS_KEY;
    const formspreeKey = context.env.FORMSPREE_KEY;
    if (!isTestEnv && !web3formsKey && !formspreeKey) {
      return new Response(JSON.stringify({ success: false, error: t('Privacy request delivery is not configured. Please email info@strovagroups.in directly.', 'गोपनीयता अनुरोध सेवा कॉन्फ़िगर नहीं है। कृपया सीधे info@strovagroups.in पर ईमेल करें।') }), {
        status: 503, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders },
      });
    }

    const trackingId = generateTrackingId();
    const receivedAt = new Date().toISOString();
    if (!isTestEnv) {
      try {
        const relayRes = web3formsKey
          ? await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: web3formsKey,
            subject: `[Privacy Request ${trackingId}] ${requestType.toUpperCase()} - ${name}`,
            from_name: 'Strova Privacy Grievance Desk',
            to_email: 'info@strovagroups.in',
            tracking_id: trackingId,
            request_type: requestType,
            data_principal_name: name,
            data_principal_email: email,
            phone: phone || 'Not provided',
            relationship: relationship || 'Client / User',
            details: details,
            received_at: receivedAt,
          }),
          signal: AbortSignal.timeout(8000),
        })
          : await fetch(`https://formspree.io/f/${formspreeKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ subject: `[Privacy Request ${trackingId}] ${requestType.toUpperCase()}`, tracking_id: trackingId, request_type: requestType, name, email, phone, relationship, details, received_at: receivedAt }),
            signal: AbortSignal.timeout(8000),
          });
        const relayBody = await relayRes.json().catch(() => ({})) as { success?: boolean; ok?: boolean };
        if (!relayRes.ok || (web3formsKey && relayBody.success === false) || (formspreeKey && relayBody.ok === false)) {
          throw new Error('relay-rejected');
        }
      } catch {
        const requestId = crypto.randomUUID();
        console.error(JSON.stringify({ event: 'privacy_request_delivery_failed', requestId }));
        return new Response(JSON.stringify({ success: false, error: t('We could not deliver your request just now. Please try again or email info@strovagroups.in.', 'अभी आपका अनुरोध भेजा नहीं जा सका। कृपया पुनः प्रयास करें या info@strovagroups.in पर ईमेल करें।'), requestId }), {
          status: 502, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders },
        });
      }
    }

    // 9. Successful Response with a company service target, not a statutory deadline.
    return new Response(
      JSON.stringify({
        success: true,
        trackingId,
        receivedAt,
        acknowledgmentTargetHours: 48,
        responseTargetDays: 30,
        message: t(
          `Your request was sent under reference ${trackingId}. We aim to acknowledge it within 48 hours and respond within 30 days. These are service targets, not statutory deadlines.`,
          `आपका अनुरोध संदर्भ ${trackingId} के तहत भेजा गया है। हम 48 घंटों में पावती और 30 दिनों में उत्तर देने का लक्ष्य रखते हैं। ये सेवा लक्ष्य हैं, वैधानिक समय-सीमाएं नहीं।`
        ),
        contact: 'info@strovagroups.in',
        requestType,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
    );
  } catch (error: any) {
    console.error(JSON.stringify({ event: 'privacy_request_unhandled', requestId, name: error?.name || 'Error' }));
    return new Response(
      JSON.stringify({
        success: false,
        requestId,
        error: 'An internal error occurred processing your request. Please email info@strovagroups.in directly.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId } }
    );
  }
};

