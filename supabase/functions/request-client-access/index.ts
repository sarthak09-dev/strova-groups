import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3';

const configuredOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',').map((value) => value.trim()).filter(Boolean);
const origins = new Set(configuredOrigins);
const jsonHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

function response(body: Record<string, unknown>, status: number, origin?: string) {
  const headers = new Headers(jsonHeaders);
  if (origin && origins.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
}

serve(async (request) => {
  const origin = request.headers.get('Origin') || undefined;
  if (request.method === 'OPTIONS') {
    if (!origin || !origins.has(origin)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Max-Age': '600',
      'Vary': 'Origin',
    } });
  }
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405, origin);
  if (!origin || !origins.has(origin)) return response({ error: 'Request could not be accepted.' }, 403);
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return response({ error: 'Request could not be accepted.' }, 415, origin);
  }
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > 12_000) return response({ error: 'Request could not be accepted.' }, 413, origin);

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 12_000) return response({ error: 'Request could not be accepted.' }, 413, origin);
    const input = JSON.parse(rawBody);
    if (!input || typeof input !== 'object' || Array.isArray(input)) return response({ error: 'Request could not be accepted.' }, 400, origin);
    // Quietly absorb automated submissions caught by the invisible honeypot.
    if (cleanText(input.website, 200)) return response({ accepted: true }, 202, origin);

    const fullName = cleanText(input.fullName, 120);
    const email = cleanText(input.email, 254).toLowerCase();
    const companyName = cleanText(input.companyName, 160) || null;
    const requestContext = cleanText(input.requestContext, 1500);
    const token = typeof input.turnstileToken === 'string' ? input.turnstileToken.slice(0, 2048) : '';
    if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || requestContext.length < 10 || input.privacyAccepted !== true || !token) {
      return response({ error: 'Check the required details and browser verification, then try again.' }, 400, origin);
    }

    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!turnstileSecret || !supabaseUrl || !serviceKey || origins.size === 0) {
      return response({ error: 'Request service is not configured.' }, 503, origin);
    }

    const verification = new FormData();
    verification.set('secret', turnstileSecret);
    verification.set('response', token);
    verification.set('idempotency_key', crypto.randomUUID());
    const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: verification, signal: AbortSignal.timeout(5000),
    });
    if (!verifyResponse.ok) return response({ error: 'Browser verification could not be completed. Please retry.' }, 503, origin);
    const challenge = await verifyResponse.json();
    const submittedHost = new URL(origin).hostname;
    if (!challenge.success || challenge.action !== 'client_access_request' || challenge.hostname !== submittedHost) {
      return response({ error: 'Browser verification failed. Please retry.' }, 403, origin);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await admin.from('client_access_requests').insert({
      full_name: fullName,
      email,
      company_name: companyName,
      request_context: requestContext,
      privacy_notice_accepted_at: new Date().toISOString(),
    });

    // A pending request already exists for this address; avoid exposing that state.
    if (error?.code === '23505') return response({ accepted: true }, 202, origin);
    if (error) return response({ error: 'Request could not be saved. Please try again later.' }, 500, origin);
    return response({ accepted: true }, 202, origin);
  } catch {
    return response({ error: 'Request could not be accepted. Please try again later.' }, 400, origin);
  }
});
