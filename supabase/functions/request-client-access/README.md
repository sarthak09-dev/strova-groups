# Client access request intake

The static portal form is only fully operational after the migration and Edge Function are deployed. Requests stay in `pending`; this endpoint never creates or invites an Auth user. The existing portal login remains invite-only (`shouldCreateUser: false`).

## Deploy

1. Link the Supabase CLI to the intended project and apply the migration with `supabase db push`.
2. In the Cloudflare Turnstile dashboard, allow the production portal hostnames and use the resulting site key as `PUBLIC_TURNSTILE_SITE_KEY` in the frontend build environment. Configure the matching secret on Supabase as `TURNSTILE_SECRET_KEY`.
3. Set Supabase Edge Function secret `ALLOWED_ORIGINS` to a comma-separated list of exact origins, for example `https://www.strovagroups.in,https://strovagroups.in`. Add a local origin only in a non-production project when needed.
4. Deploy this public intake function with `supabase functions deploy request-client-access --no-verify-jwt`. The function enforces its own Origin allowlist and Turnstile verification; database access uses the server-only Supabase service role key supplied by the Edge Function runtime. Never add that key to frontend environment variables.
5. Confirm Turnstile is enabled in Supabase Auth for the existing OTP sign-in flow. The portal reuses the widget, then resets the one-use challenge after each submission.

## Review and approval

The table has RLS enabled and no browser-role policies or grants. Only trusted service-role code can access it. A future desktop admin tool should authenticate its operator, authorize admin role server-side, review pending rows, and create/invite the Auth user only after an explicit approval. Do not expose the service-role key to the desktop client. Until that review tool exists, inspect requests through a trusted Supabase administrative interface; applicants cannot approve themselves.

The form requires a valid Turnstile challenge and deduplicates concurrent pending requests by normalized email. Configure and monitor Cloudflare rate controls as an additional operational abuse limit; the function does not claim a globally shared per-IP rate limiter.
