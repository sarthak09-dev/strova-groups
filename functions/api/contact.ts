/**
 * Cloudflare Pages Function: /api/contact
 * Handles inbound project briefs with server-side validation, honeypot detection,
 * Cloudflare Turnstile verification, and configurable delivery relay.
 */

interface Env {
  TURNSTILE_SECRET_KEY?: string;
  CONTACT_API_KEY?: string;
  WEB3FORMS_ACCESS_KEY?: string;
  FORMSPREE_KEY?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const contentType = context.request.headers.get('content-type') || '';
    let payload: Record<string, any> = {};

    if (contentType.includes('application/json')) {
      payload = await context.request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await context.request.formData();
      formData.forEach((value, key) => {
        payload[key] = typeof value === 'string' ? value : value.name;
      });
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Unsupported Content-Type header.' }),
        { status: 415, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Honeypot check (reject bot submissions)
    const honeypot = (payload._hp_company || '').trim();
    if (honeypot) {
      return new Response(
        JSON.stringify({ success: false, error: 'Automated request rejected.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Field validation
    const name = (payload.name || '').trim();
    const email = (payload.email || '').trim();
    const phone = (payload.phone || '').trim();
    const company = (payload.company || '').trim();
    const service = (payload.service || '').trim();
    const budget = (payload.budget || '').trim();
    const message = (payload.message || '').trim();
    const turnstileToken = (payload['cf-turnstile-response'] || '').trim();

    if (!name || name.length < 2 || name.length > 100) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please provide a valid name (2-100 characters).' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email) || email.length > 120) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please provide a valid email address.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!service) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please select a service category.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!message || message.length < 10 || message.length > 5000) {
      return new Response(
        JSON.stringify({ success: false, error: 'Message must be between 10 and 5,000 characters.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Cloudflare Turnstile verification if secret key is present
    const turnstileSecret = context.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret && turnstileToken) {
      const clientIp = context.request.headers.get('cf-connecting-ip') || '';
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
            error: 'Security challenge verification failed. Please try again or reach us via WhatsApp/email.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4. Relay to external email delivery service if configured
    const web3formsKey = context.env.WEB3FORMS_ACCESS_KEY || context.env.CONTACT_API_KEY;
    const formspreeKey = context.env.FORMSPREE_KEY;

    if (web3formsKey) {
      const relayRes = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: web3formsKey,
          subject: `New Project Inquiry from ${name} (${service})`,
          from_name: 'Strova Group Inbound',
          name,
          email,
          phone: phone || 'Not provided',
          company: company || 'Not provided',
          service,
          budget: budget || 'Not specified',
          message,
        }),
      });

      if (!relayRes.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Delivery service error. Please email us directly at info@strovagroups.in or use WhatsApp.',
          }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else if (formspreeKey) {
      const relayRes = await fetch(`https://formspree.io/f/${formspreeKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name, email, phone, company, service, budget, message }),
      });

      if (!relayRes.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Delivery service error. Please email us directly at info@strovagroups.in or use WhatsApp.',
          }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Successful processing
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Your project brief has been received. We review all inquiries within 24 business hours (Mon–Sat, 10:00 AM – 7:00 PM IST) and will email our technical assessment.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred while processing your brief. Please email info@strovagroups.in or WhatsApp +91 92880 77802.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

