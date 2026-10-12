/**
 * Cloudflare Pages Function: /api/contact
 * Handles inbound project quote requests with:
 * - Fail-closed delivery architecture (HTTP 503 if no relay key configured)
 * - Origin & Referer verification
 * - Rate limiting & payload size constraints
 * - Cloudflare Turnstile bot verification (mandatory if TURNSTILE_SECRET_KEY is set)
 * - Strict maximum field lengths & sanitization
 */

interface Env {
  TURNSTILE_SECRET_KEY?: string;
  CONTACT_API_KEY?: string;
  WEB3FORMS_ACCESS_KEY?: string;
  FORMSPREE_KEY?: string;
}

// In-memory rate limiting map for edge worker instance
const rateLimitMap = new Map<string, { count: number; firstSeen: number }>();

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const request = context.request;

    // 1. Origin & Referer Verification
    const origin = request.headers.get('origin') || '';
    const referer = request.headers.get('referer') || '';
    const allowedHosts = ['strovagroups.in', 'www.strovagroups.in', 'localhost', '127.0.0.1'];
    
    const isValidOrigin = allowedHosts.some(
      (h) => origin.includes(h) || referer.includes(h) || (!origin && !referer)
    );

    if (!isValidOrigin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized request origin.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. IP Rate Limiting (max 5 submissions per 10 minutes per IP)
    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown-ip';
    const now = Date.now();
    const rateWindow = 10 * 60 * 1000; // 10 minutes
    const ipRecord = rateLimitMap.get(clientIp);

    if (ipRecord) {
      if (now - ipRecord.firstSeen < rateWindow) {
        if (ipRecord.count >= 5) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Rate limit exceeded. Please wait a few minutes before submitting another quote request, or email info@strovagroups.in directly.',
            }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
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

    // 3. Content-Type Parsing
    const contentType = request.headers.get('content-type') || '';
    let payload: Record<string, string> = {};

    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        payload[key] = typeof value === 'string' ? value : value.name;
      });
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Unsupported Content-Type header.' }),
        { status: 415, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Honeypot check (reject automated bots silently)
    const honeypot = (payload._hp_company || '').trim();
    if (honeypot) {
      return new Response(
        JSON.stringify({ success: false, error: 'Automated request rejected.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Strict Field Validation & Length Limits
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
        JSON.stringify({ success: false, error: 'Please provide a valid name (2 to 100 characters).' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email) || email.length > 120) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please provide a valid email address (max 120 characters).' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!message || message.length < 10 || message.length > 3000) {
      return new Response(
        JSON.stringify({ success: false, error: 'Project description must be between 10 and 3,000 characters.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Optional fields length checks
    if (company.length > 120) {
      return new Response(
        JSON.stringify({ success: false, error: 'Company name must not exceed 120 characters.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (phone.length > 30) {
      return new Response(
        JSON.stringify({ success: false, error: 'Phone number must not exceed 30 characters.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (timeline.length > 100) {
      return new Response(
        JSON.stringify({ success: false, error: 'Timeline must not exceed 100 characters.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Turnstile Verification (Mandatory whenever TURNSTILE_SECRET_KEY is configured)
    const turnstileSecret = context.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret) {
      if (!turnstileToken) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Security verification token missing. Please complete the Turnstile challenge.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const verifyFormData = new FormData();
      verifyFormData.append('secret', turnstileSecret);
      verifyFormData.append('response', turnstileToken);
      if (clientIp) verifyFormData.append('remoteip', clientIp);

      const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: verifyFormData,
      });

      const outcome = (await turnstileRes.json()) as { success: boolean; 'error-codes'?: string[] };
      if (!outcome.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Security challenge verification failed. Please try again or reach us via email.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 7. Fail-Closed Relay Check: Return 503 if no relay key is set
    const web3formsKey = context.env.WEB3FORMS_ACCESS_KEY || context.env.CONTACT_API_KEY;
    const formspreeKey = context.env.FORMSPREE_KEY;

    if (!web3formsKey && !formspreeKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Form relay service is currently unconfigured on this deployment. Please email your project requirements directly to info@strovagroups.in or WhatsApp +91 92880 77802.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 8. Forward to Configured Relay
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
            error: 'Email delivery relay error. Please email us directly at info@strovagroups.in or WhatsApp +91 92880 77802.',
          }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
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
            error: 'Email delivery relay error. Please email us directly at info@strovagroups.in or WhatsApp +91 92880 77802.',
          }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 9. Success Response
    return new Response(
      JSON.stringify({
        success: true,
        redirectUrl: '/quote/confirmed/',
        message: 'Your quote request has been received. We review all specifications and reply with a written fixed quote within 1 business day.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
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
