import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token, remoteip } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'Turnstile token missing' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const secretKey = Deno.env.get('TURNSTILE_SECRET_KEY');

    // If Cloudflare Turnstile secret key is configured in environment
    if (secretKey) {
      const formData = new FormData();
      formData.append('secret', secretKey);
      formData.append('response', token);
      if (remoteip) formData.append('remoteip', remoteip);

      const cfResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData,
      });

      const outcome = await cfResponse.json();
      if (!outcome.success) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Turnstile challenge verification failed',
          errorCodes: outcome['error-codes'],
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Development / sandbox mode: Check for deterministic dummy tokens or test sitekey tokens
      // Disallow empty/arbitrary random tokens
      if (token === 'XXXX.DUMMY.TOKEN.XXXX' || token.startsWith('1x00000000000000000000AA') || token === 'cf-test-token-pass') {
        return new Response(JSON.stringify({
          success: true,
          mode: 'development_sandbox',
          warning: 'Turnstile verified using test key because TURNSTILE_SECRET_KEY is unconfigured.',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid Turnstile verification token',
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

