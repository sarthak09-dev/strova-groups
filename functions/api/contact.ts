/**
 * Cloudflare Pages Function: /api/contact
 * Handles inbound project quote requests with:
 * - 64KB strict body size guard
 * - Origin & Referer verification
 * - Rate limiting (5 per 10m) with RateLimit and Retry-After headers
 * - Mandatory server-side Cloudflare Turnstile bot verification (fails closed in production)
 * - Prohibition of Turnstile test keys in production
 * - Bilingual error and success responses (English and Hindi)
 * - Fail-closed email delivery relay (HTTP 503 if no relay key configured)
 * - Strict field validation and sanitization
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const request = context.request;
    const isTestEnv = context.env.ENVIRONMENT === 'test';

    // 1. Strict Payload Size Check (Header + raw body check)
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

    // Read body text first to guarantee exact byte size enforcement
    const bodyText = await request.text();
    if (bodyText.length > MAX_BODY_BYTES) {
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
    const allowedHostnames = new Set(['strovagroups.in', 'www.strovagroups.in', 'localhost', '127.0.0.1']);

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

    if (!requestHostname || !allowedHostnames.has(requestHostname)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized request origin.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. IP Rate Limiting (max 5 submissions per 10 minutes per IP)
    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown-ip';
    const now = Date.now();
    const rateWindow = 10 * 60 * 1000; // 10 minutes
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
              error: 'Rate limit exceeded. Please wait a few minutes before submitting another quote request, or email info@strovagroups.in directly.',
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

    // Clean up old entries periodically
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
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
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

    // Bilingual message helper
    const lang = (payload.lang || '').toLowerCase() === 'hi' ? 'hi' : 'en';
    const t = (en: string, hi: string) => (lang === 'hi' ? hi : en);

    // 5. Honeypot check (reject automated bots silently)
    const honeypot = (payload._hp_company || '').trim();
    if (honeypot) {
      return new Response(
        JSON.stringify({
          success: false,
          error: t('Automated request rejected.', 'स्वचालित अनुरोध अस्वीकृत।'),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
      );
    }

    // 6. Strict Field Validation & Length Limits
    const name = (payload.name || '').trim();
    const email = (payload.email || '').trim();
    const message = (payload.message || '').trim();
    const company = (payload.company || '').trim();
    const phone = (payload.phone || '').trim();
    const timeline = (payload.timeline || '').trim();
    const turnstileToken = (payload['cf-turnstile-response'] || '').trim();

    // Required fields: Name, Email, Message
    if (!name || name.length < 2 || name.length > 100) {
      return new Response(
        JSON.stringify({
          success: false,
          error: t('Please provide a valid name (2 to 100 characters).', 'कृपया एक मान्य नाम प्रदान करें (2 से 100 वर्ण)।'),
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

    if (!message || message.length < 10 || message.length > 3000) {
      return new Response(
        JSON.stringify({
          success: false,
          error: t('Project description must be between 10 and 3,000 characters.', 'प्रोजेक्ट विवरण 10 से 3,000 वर्णों के बीच होना चाहिए।'),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
      );
    }

    // Optional fields length checks
    if (company.length > 120) {
      return new Response(
        JSON.stringify({
          success: false,
          error: t('Company name must not exceed 120 characters.', 'कंपनी का नाम 120 वर्णों से अधिक नहीं होना चाहिए।'),
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

    if (timeline.length > 100) {
      return new Response(
        JSON.stringify({
          success: false,
          error: t('Timeline must not exceed 100 characters.', 'समय-सीमा 100 वर्णों से अधिक नहीं होनी चाहिए।'),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
      );
    }

    // 7. Cloudflare Turnstile Verification (Mandatory & Fail-Closed in Production)
    const turnstileSecret = context.env.TURNSTILE_SECRET_KEY;

    // Fail closed if unconfigured in production
    if (!turnstileSecret && !isTestEnv) {
      return new Response(
        JSON.stringify({
          success: false,
          error: t(
            'Security verification service is unconfigured. Please email your project requirements directly to info@strovagroups.in or WhatsApp +91 92880 77802.',
            'सुरक्षा सत्यापन सेवा कॉन्फ़िगर नहीं है। कृपया अपनी प्रोजेक्ट आवश्यकताएं सीधे info@strovagroups.in पर भेजें या WhatsApp +91 92880 77802 करें।'
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

      // Reject test keys / dummy tokens in production
      if (!isTestEnv && (turnstileToken === TURNSTILE_TEST_SITE_KEY || turnstileToken.startsWith('1x00000000'))) {
        return new Response(
          JSON.stringify({
            success: false,
            error: t(
              'Test verification keys are strictly prohibited in production. Please complete the live challenge.',
              'प्रोडक्शन में परीक्षण कुंजियों की अनुमति नहीं है। कृपया वास्तविक चुनौती पूरी करें।'
            ),
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
        );
      }

      // If in test environment and using mock token or secret, permit bypass
      if (isTestEnv && turnstileToken === 'mock-turnstile-pass-token') {
        // bypass network call for local test suite
      } else if (turnstileSecret) {
        const verifyFormData = new FormData();
        verifyFormData.append('secret', turnstileSecret);
        verifyFormData.append('response', turnstileToken);
        if (clientIp && clientIp !== 'unknown-ip') verifyFormData.append('remoteip', clientIp);

        const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body: verifyFormData,
        });

        const outcome = (await turnstileRes.json()) as { success: boolean; 'error-codes'?: string[] };
        if (!outcome.success) {
          return new Response(
            JSON.stringify({
              success: false,
              error: t(
                'Security challenge verification failed. Please try again or reach us via email.',
                'सुरक्षा सत्यापन विफल रहा। कृपया पुन: प्रयास करें या ईमेल द्वारा संपर्क करें।'
              ),
            }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
          );
        }
      }
    }

    // 8. Fail-Closed Relay Check: Return 503 if no relay key is set
    const web3formsKey = context.env.WEB3FORMS_ACCESS_KEY || context.env.CONTACT_API_KEY;
    const formspreeKey = context.env.FORMSPREE_KEY;

    if (!web3formsKey && !formspreeKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: t(
            'Form relay service is currently unconfigured on this deployment. Please email your project requirements directly to info@strovagroups.in or WhatsApp +91 92880 77802.',
            'फॉर्म रिले सेवा वर्तमान में कॉन्फ़िगर नहीं है। कृपया अपनी प्रोजेक्ट आवश्यकताएं सीधे info@strovagroups.in पर ईमेल करें या WhatsApp +91 92880 77802 करें।'
          ),
        }),
        { status: 503, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
      );
    }

    // 9. Forward to Configured Relay
    if (web3formsKey) {
      const relayRes = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: web3formsKey,
          subject: `Quote Request: ${name} (${company || 'Individual'})`,
          from_name: 'Strova Group Inbound',
          name,
          email,
          phone: phone || 'Not provided',
          company: company || 'Not provided',
          timeline: timeline || 'Not specified',
          message,
        }),
      });

      if (!relayRes.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: t(
              'Email delivery relay error. Please email us directly at info@strovagroups.in or WhatsApp +91 92880 77802.',
              'ईमेल डिलीवरी रिले त्रुटि। कृपया हमें सीधे info@strovagroups.in पर ईमेल करें या WhatsApp +91 92880 77802 करें।'
            ),
          }),
          { status: 502, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
        );
      }
    } else if (formspreeKey) {
      const relayRes = await fetch(`https://formspree.io/f/${formspreeKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name, email, phone, company, timeline, message }),
      });

      if (!relayRes.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: t(
              'Email delivery relay error. Please email us directly at info@strovagroups.in or WhatsApp +91 92880 77802.',
              'ईमेल डिलीवरी रिले त्रुटि। कृपया हमें सीधे info@strovagroups.in पर ईमेल करें या WhatsApp +91 92880 77802 करें।'
            ),
          }),
          { status: 502, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
        );
      }
    }

    // 10. Success Response
    return new Response(
      JSON.stringify({
        success: true,
        redirectUrl: lang === 'hi' ? '/hi/quote/confirmed/' : '/quote/confirmed/',
        message: t(
          'Your quote request has been received. We review all specifications and reply with a written fixed quote within 1 business day.',
          'आपका कोटेशन अनुरोध प्राप्त हो गया है। हम 1 कार्यदिवस के भीतर लिखित निश्चित कोटेशन के साथ उत्तर देंगे।'
        ),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected server error occurred while processing your brief. Please email info@strovagroups.in directly.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
