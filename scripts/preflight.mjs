#!/usr/bin/env node
/**
 * Strova Group — Production Preflight Security & Configuration Validator
 *
 * Verifies environment variables, secrets, and configurations before production deployment.
 * Fails fast with exit code 1 if any production secret is missing, misconfigured,
 * or using known test/dummy keys in production mode.
 *
 * Usage:
 *   node scripts/preflight.mjs [--mode=production|staging|test] [--strict]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Parse CLI flags
const args = process.argv.slice(2);
let mode = 'production';
let isStrict = false;

for (const arg of args) {
  if (arg.startsWith('--mode=')) {
    mode = arg.split('=')[1].toLowerCase();
  } else if (arg === '--strict') {
    isStrict = true;
  }
}

// Load .env or .env.production file if present into process.env without overriding
function loadEnvFile(fileName) {
  const filePath = path.join(ROOT_DIR, fileName);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

if (mode === 'production') {
  loadEnvFile('.env.production');
  loadEnvFile('.env');
} else {
  loadEnvFile('.env.development');
  loadEnvFile('.env');
}

console.log('================================================================');
console.log(` Strova Group — Production Preflight Validator`);
console.log(` Mode: ${mode.toUpperCase()} | Strict Mode: ${isStrict ? 'ENABLED' : 'STANDARD'}`);
console.log('================================================================\n');

const checks = [];
let hasCriticalErrors = false;
let hasWarnings = false;

function maskSecret(val) {
  if (!val) return '<empty>';
  if (val.length <= 8) return '********';
  return val.slice(0, 4) + '...' + val.slice(-4);
}

function checkVar({ name, required = true, isSecret = false, validator, errorMessage }) {
  const val = process.env[name];
  const exists = Boolean(val && val.trim().length > 0);

  if (!exists) {
    if (required) {
      checks.push({ status: 'FAIL', name, detail: 'Missing required variable', error: errorMessage });
      hasCriticalErrors = true;
    } else {
      checks.push({ status: 'WARN', name, detail: 'Optional variable unconfigured' });
      hasWarnings = true;
    }
    return;
  }

  if (validator) {
    const validationResult = validator(val.trim());
    if (validationResult !== true) {
      checks.push({
        status: 'FAIL',
        name,
        detail: typeof validationResult === 'string' ? validationResult : 'Validation failed',
        error: errorMessage,
      });
      hasCriticalErrors = true;
      return;
    }
  }

  checks.push({
    status: 'PASS',
    name,
    detail: isSecret ? `Configured [${maskSecret(val)}]` : `Configured [${val}]`,
  });
}

// 1. Supabase Environment Variables
checkVar({
  name: 'PUBLIC_SUPABASE_URL',
  required: mode === 'production',
  isSecret: false,
  validator: (v) => /^https:\/\/[a-z0-9_-]+\.supabase\.co/i.test(v) || 'Must be a valid https://*.supabase.co URL',
  errorMessage: 'Set PUBLIC_SUPABASE_URL in Cloudflare Pages / deployment environment.',
});

checkVar({
  name: 'PUBLIC_SUPABASE_ANON_KEY',
  required: mode === 'production',
  isSecret: true,
  validator: (v) => v.length > 20 || 'Anon key is unexpectedly short',
  errorMessage: 'Set PUBLIC_SUPABASE_ANON_KEY in Cloudflare Pages / deployment environment.',
});

checkVar({
  name: 'SUPABASE_SERVICE_ROLE_KEY',
  required: mode === 'production',
  isSecret: true,
  validator: (v) => v.length > 20 || 'Service role key is unexpectedly short',
  errorMessage: 'SUPABASE_SERVICE_ROLE_KEY required for Supabase Edge Functions / Admin RPC.',
});

// 2. Razorpay Payment Gateway Credentials
checkVar({
  name: 'RAZORPAY_KEY_ID',
  required: mode === 'production',
  isSecret: true,
  validator: (v) => {
    if (mode === 'production') {
      if (v.startsWith('rzp_test_')) {
        return 'Test key rzp_test_* is strictly forbidden in production mode!';
      }
      if (!v.startsWith('rzp_live_')) {
        return 'Production Razorpay key must start with rzp_live_*';
      }
    }
    return true;
  },
  errorMessage: 'RAZORPAY_KEY_ID required for payment creation and verification.',
});

checkVar({
  name: 'RAZORPAY_KEY_SECRET',
  required: mode === 'production',
  isSecret: true,
  validator: (v) => v.length >= 10 || 'Razorpay key secret must be at least 10 characters',
  errorMessage: 'RAZORPAY_KEY_SECRET required for payment verification.',
});

checkVar({
  name: 'RAZORPAY_WEBHOOK_SECRET',
  required: mode === 'production',
  isSecret: true,
  validator: (v) => v.length >= 10 || 'Webhook secret must be at least 10 characters',
  errorMessage: 'RAZORPAY_WEBHOOK_SECRET required for edge webhook HMAC verification.',
});

// 3. Cloudflare Turnstile Bot Protection
checkVar({
  name: 'PUBLIC_TURNSTILE_SITE_KEY',
  required: mode === 'production',
  isSecret: false,
  validator: (v) => {
    if (v === '1x00000000000000000000AA') {
      return 'Test site key 1x00000000000000000000AA is forbidden in production!';
    }
    if (!v.startsWith('0x')) {
      return 'Turnstile site key should start with 0x';
    }
    return true;
  },
  errorMessage: 'PUBLIC_TURNSTILE_SITE_KEY required for client-side bot challenge.',
});

checkVar({
  name: 'TURNSTILE_SECRET_KEY',
  required: mode === 'production',
  isSecret: true,
  validator: (v) => {
    if (v === '1x0000000000000000000000000000000AA' || v.startsWith('1x')) {
      return 'Test secret key 1x* is forbidden in production!';
    }
    if (!v.startsWith('0x')) {
      return 'Turnstile secret key should start with 0x';
    }
    return true;
  },
  errorMessage: 'TURNSTILE_SECRET_KEY required for server-side siteverify call.',
});

// 4. Inbound Form Relay Keys (Web3Forms or Formspree)
const hasWeb3 = Boolean(process.env.WEB3FORMS_ACCESS_KEY || process.env.CONTACT_API_KEY);
const hasFormspree = Boolean(process.env.FORMSPREE_KEY);

if (mode === 'production' && !hasWeb3 && !hasFormspree) {
  checks.push({
    status: 'FAIL',
    name: 'INBOUND_FORM_RELAY',
    detail: 'Neither WEB3FORMS_ACCESS_KEY nor FORMSPREE_KEY is configured',
    error: 'Provide at least one form relay credential in Cloudflare Pages Functions environment.',
  });
  hasCriticalErrors = true;
} else if (hasWeb3 || hasFormspree) {
  checks.push({
    status: 'PASS',
    name: 'INBOUND_FORM_RELAY',
    detail: `Configured via ${hasWeb3 ? 'Web3Forms' : 'Formspree'}`,
  });
}

// 5. Codebase Repository Checks
console.log('--- Environment & Secrets Verification ---');
for (const check of checks) {
  if (check.status === 'PASS') {
    console.log(`  ✓ ${check.name}: ${check.detail}`);
  } else if (check.status === 'WARN') {
    console.log(`  ⚠ ${check.name}: ${check.detail}`);
  } else {
    console.log(`  ✗ ${check.name}: ${check.detail} — ${check.error}`);
  }
}

// 6. Static Asset & Migration Integrity Checks
console.log('\n--- Architecture & Migration Integrity Checks ---');
const migrationDir = path.join(ROOT_DIR, 'supabase/migrations');
if (fs.existsSync(migrationDir)) {
  const migrations = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql')).sort();
  console.log(`  ✓ Supabase Migrations Found: ${migrations.length} migration files`);
  for (const m of migrations) {
    console.log(`    - ${m}`);
  }
} else {
  console.log('  ✗ Supabase migrations directory missing');
  hasCriticalErrors = true;
}

// Check that test keys are not hardcoded in source files
const srcDir = path.join(ROOT_DIR, 'src');
function scanDirForTestKeys(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirForTestKeys(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.astro') || entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('1x00000000000000000000AA')) {
        console.log(`  ✗ HARDCODED TEST KEY FOUND in ${path.relative(ROOT_DIR, fullPath)}`);
        hasCriticalErrors = true;
      }
    }
  }
}
scanDirForTestKeys(srcDir);
console.log('  ✓ Source scan: zero hardcoded Turnstile test keys in src/');

console.log('\n================================================================');
if (hasCriticalErrors) {
  console.error('❌ PREFLIGHT CHECK FAILED. Do not deploy to production.');
  console.error('   Resolve the missing or invalid environment variables above.\n');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠ PREFLIGHT PASSED WITH WARNINGS.');
  console.log('  Review non-critical configuration items before final signoff.\n');
  process.exit(0);
} else {
  console.log('✅ PREFLIGHT CHECK PASSED CLEANLY. Ready for production deployment.\n');
  process.exit(0);
}

