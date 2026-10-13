/**
 * Strova Group Client Portal — Client Data Layer Entrypoint
 * Host: portal.strovagroups.in
 *
 * Safe client-side bundle: Pure browser types, stage calculation rules,
 * and authenticated Supabase client functions.
 * ZERO server-only secrets (service role keys) are referenced or exposed here.
 */

export * from './portalTypes';
export * from './supabaseClient';
export * from './sanitize';
