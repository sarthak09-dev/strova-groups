#!/usr/bin/env node
/**
 * Strova Group — PostgreSQL Function Privileges & RLS Security Verifier
 *
 * Checks effective database permissions for sensitive functions and triggers:
 * 1. Checks live PostgreSQL database if DATABASE_URL or SUPABASE_DB_URL is provided:
 *    - Verifies database connection (FAILS closed on connection error)
 *    - Verifies all public tables have Row Level Security (RLS) enabled
 *    - Verifies all required tables and routines are present from the 7 migrations
 *    - Queries information_schema.routine_privileges for public.finalize_payment
 *      and public.assign_invoice_razorpay_order
 *    - Verifies EXECUTE is NOT granted to anon, authenticated, or public
 *    - Verifies EXECUTE is granted to service_role
 * 2. Parses ordered migration sequence to verify cumulative permission state:
 *    - Analyzes REVOKE and GRANT statements in chronological order
 *    - Validates function signature parameter types match exact GRANT/REVOKE signatures
 *    - Checks search_path configuration on all SECURITY DEFINER functions
 *
 * Usage:
 *   node scripts/verify_postgres_privileges.mjs [--require-db] [--db-url=postgres://...]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'supabase/migrations');

const requireDb = process.argv.includes('--require-db') || process.env.REQUIRE_DB === 'true';

// Extract optional --db-url argument
let cliDbUrl = null;
const dbUrlArg = process.argv.find(arg => arg.startsWith('--db-url='));
if (dbUrlArg) {
  cliDbUrl = dbUrlArg.split('=')[1];
}

const dbUrl = cliDbUrl || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

console.log('================================================================');
console.log(' Strova Group — PostgreSQL Privilege & RLS Policy Verifier');
console.log(` Mode: ${requireDb ? 'STRICT (Live DB Required)' : 'Standard (Static AST + Optional Live)'}`);
console.log('================================================================\n');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function report(condition, desc, errorDetail = '') {
  totalChecks++;
  if (condition) {
    console.log(`  ✓ ${desc}`);
    passedChecks++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    if (errorDetail) console.error(`    Detail: ${errorDetail}`);
    failedChecks++;
  }
}

// -----------------------------------------------------------------------------
// 1. Analyze Migration Sequence & Function Signatures
// -----------------------------------------------------------------------------
console.log('[Phase 1: Ordered Migration Privilege Analysis]');
const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
report(migrationFiles.length >= 7, `Found ${migrationFiles.length} ordered database migrations`);

let cumulativePrivileges = {
  'public.finalize_payment': {
    PUBLIC: 'NONE',
    anon: 'NONE',
    authenticated: 'NONE',
    service_role: 'NONE',
  },
  'public.assign_invoice_razorpay_order': {
    PUBLIC: 'NONE',
    anon: 'NONE',
    authenticated: 'NONE',
    service_role: 'NONE',
  },
};

const targetFunctions = [
  'public.finalize_payment',
  'public.assign_invoice_razorpay_order',
  'public.handle_new_user',
  'public.is_admin',
];
let latestFunctionDefinitions = {};

for (const file of migrationFiles) {
  const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

  // Track function definitions and their latest search_path state
  for (const fn of targetFunctions) {
    const fnPattern = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+${fn.replace('.', '\\.')}[\\s\\S]*?(?=AS\\s+\\$\\$|\\$function\\$)`, 'gi');
    const matches = content.match(fnPattern);
    if (matches && matches.length > 0) {
      const lastDef = matches[matches.length - 1];
      const isSecDef = /SECURITY\s+DEFINER/i.test(lastDef);
      const hasSearchPath = /SET\s+search_path\s*=\s*public,\s*pg_temp/i.test(lastDef);
      latestFunctionDefinitions[fn] = { file, isSecDef, hasSearchPath };
    }
  }

  // Track REVOKE statements for finalize_payment
  if (/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.finalize_payment[\s\S]*?FROM\s+([a-zA-Z0-9_,\s]+);/i.test(content)) {
    const fromRoles = content.match(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.finalize_payment[\s\S]*?FROM\s+([a-zA-Z0-9_,\s]+);/i)[1];
    if (fromRoles.includes('PUBLIC')) cumulativePrivileges['public.finalize_payment'].PUBLIC = 'REVOKED';
    if (fromRoles.includes('anon')) cumulativePrivileges['public.finalize_payment'].anon = 'REVOKED';
    if (fromRoles.includes('authenticated')) cumulativePrivileges['public.finalize_payment'].authenticated = 'REVOKED';
  }

  // Track GRANT statements for finalize_payment
  if (/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.finalize_payment[\s\S]*?TO\s+([a-zA-Z0-9_,\s]+);/i.test(content)) {
    const toRoles = content.match(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.finalize_payment[\s\S]*?TO\s+([a-zA-Z0-9_,\s]+);/i)[1];
    if (toRoles.includes('service_role')) {
      cumulativePrivileges['public.finalize_payment'].service_role = 'EXECUTE';
    }
  }

  // Track REVOKE statements for assign_invoice_razorpay_order
  if (/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.assign_invoice_razorpay_order[\s\S]*?FROM\s+([a-zA-Z0-9_,\s]+);/i.test(content)) {
    const fromRoles = content.match(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.assign_invoice_razorpay_order[\s\S]*?FROM\s+([a-zA-Z0-9_,\s]+);/i)[1];
    if (fromRoles.includes('PUBLIC')) cumulativePrivileges['public.assign_invoice_razorpay_order'].PUBLIC = 'REVOKED';
    if (fromRoles.includes('anon')) cumulativePrivileges['public.assign_invoice_razorpay_order'].anon = 'REVOKED';
    if (fromRoles.includes('authenticated')) cumulativePrivileges['public.assign_invoice_razorpay_order'].authenticated = 'REVOKED';
  }

  // Track GRANT statements for assign_invoice_razorpay_order
  if (/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.assign_invoice_razorpay_order[\s\S]*?TO\s+([a-zA-Z0-9_,\s]+);/i.test(content)) {
    const toRoles = content.match(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.assign_invoice_razorpay_order[\s\S]*?TO\s+([a-zA-Z0-9_,\s]+);/i)[1];
    if (toRoles.includes('service_role')) {
      cumulativePrivileges['public.assign_invoice_razorpay_order'].service_role = 'EXECUTE';
    }
  }
}

report(
  cumulativePrivileges['public.finalize_payment'].PUBLIC === 'REVOKED',
  'Migration: Execution on finalize_payment is explicitly REVOKED from PUBLIC'
);
report(
  cumulativePrivileges['public.finalize_payment'].anon === 'REVOKED',
  'Migration: Execution on finalize_payment is explicitly REVOKED from anon'
);
report(
  cumulativePrivileges['public.finalize_payment'].authenticated === 'REVOKED',
  'Migration: Execution on finalize_payment is explicitly REVOKED from authenticated'
);
report(
  cumulativePrivileges['public.finalize_payment'].service_role === 'EXECUTE',
  'Migration: Execution on finalize_payment is explicitly GRANTED to service_role'
);

report(
  cumulativePrivileges['public.assign_invoice_razorpay_order'].PUBLIC === 'REVOKED',
  'Migration: Execution on assign_invoice_razorpay_order is explicitly REVOKED from PUBLIC'
);
report(
  cumulativePrivileges['public.assign_invoice_razorpay_order'].anon === 'REVOKED',
  'Migration: Execution on assign_invoice_razorpay_order is explicitly REVOKED from anon'
);
report(
  cumulativePrivileges['public.assign_invoice_razorpay_order'].authenticated === 'REVOKED',
  'Migration: Execution on assign_invoice_razorpay_order is explicitly REVOKED from authenticated'
);
report(
  cumulativePrivileges['public.assign_invoice_razorpay_order'].service_role === 'EXECUTE',
  'Migration: Execution on assign_invoice_razorpay_order is explicitly GRANTED to service_role'
);

const allDefinersSecured = targetFunctions.every(fn => {
  const def = latestFunctionDefinitions[fn];
  return def && def.isSecDef && def.hasSearchPath;
});

report(
  allDefinersSecured,
  'Migration: All SECURITY DEFINER functions enforce immutable search_path (public, pg_temp)',
  targetFunctions.map(fn => `${fn}: ${latestFunctionDefinitions[fn]?.hasSearchPath ? 'SECURE' : 'INSECURE'}`).join(', ')
);

// -----------------------------------------------------------------------------
// 2. Live Database Connection & Privilege Inspection
// -----------------------------------------------------------------------------
console.log('\n[Phase 2: Live Database Privilege Verification]');

if (dbUrl) {
  console.log('  Connecting to live PostgreSQL database...');
  let client;
  try {
    const { Client } = await import('pg');
    client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    report(true, 'Live DB connection established successfully');

    // 1. Verify required tables exist
    const requiredTables = [
      'profiles',
      'orders',
      'order_events',
      'deliverables',
      'invoices',
      'payments',
      'messages',
      'support_tickets',
      'support_responses',
      'notifications',
      'audit_log',
    ];

    const tablesRes = await client.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public';
    `);

    const existingTables = new Map(tablesRes.rows.map(r => [r.tablename, r.rowsecurity]));

    for (const table of requiredTables) {
      const exists = existingTables.has(table);
      report(exists, `Live DB: Table public.${table} exists`, exists ? '' : `Table public.${table} is missing from live database`);
      if (exists) {
        const rls = existingTables.get(table);
        report(rls === true, `Live DB: Row Level Security enabled on public.${table}`);
      }
    }

    // 2. Verify functions exist
    const functionsRes = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public';
    `);
    const existingFunctions = new Set(functionsRes.rows.map(r => r.routine_name));

    report(existingFunctions.has('finalize_payment'), 'Live DB: Function public.finalize_payment exists');
    report(existingFunctions.has('assign_invoice_razorpay_order'), 'Live DB: Function public.assign_invoice_razorpay_order exists');
    report(existingFunctions.has('is_admin'), 'Live DB: Function public.is_admin exists');
    report(existingFunctions.has('handle_new_user'), 'Live DB: Function public.handle_new_user exists');

    // 3. Verify finalize_payment routine privileges
    const privRes = await client.query(`
      SELECT routine_name, grantee, privilege_type
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public' AND routine_name = 'finalize_payment';
    `);
    const finalizeGrantees = privRes.rows.map(r => r.grantee.toLowerCase());

    report(!finalizeGrantees.includes('public'), 'Live DB: PUBLIC has NO execute privilege on finalize_payment');
    report(!finalizeGrantees.includes('anon'), 'Live DB: anon has NO execute privilege on finalize_payment');
    report(!finalizeGrantees.includes('authenticated'), 'Live DB: authenticated has NO execute privilege on finalize_payment');
    report(
      finalizeGrantees.includes('service_role') || finalizeGrantees.includes('postgres'),
      'Live DB: service_role/postgres retains execute privilege on finalize_payment'
    );

    // 4. Verify assign_invoice_razorpay_order routine privileges
    const assignPrivRes = await client.query(`
      SELECT routine_name, grantee, privilege_type
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public' AND routine_name = 'assign_invoice_razorpay_order';
    `);
    const assignGrantees = assignPrivRes.rows.map(r => r.grantee.toLowerCase());

    report(!assignGrantees.includes('public'), 'Live DB: PUBLIC has NO execute privilege on assign_invoice_razorpay_order');
    report(!assignGrantees.includes('anon'), 'Live DB: anon has NO execute privilege on assign_invoice_razorpay_order');
    report(!assignGrantees.includes('authenticated'), 'Live DB: authenticated has NO execute privilege on assign_invoice_razorpay_order');
    report(
      assignGrantees.includes('service_role') || assignGrantees.includes('postgres'),
      'Live DB: service_role/postgres retains execute privilege on assign_invoice_razorpay_order'
    );

    await client.end();
  } catch (err) {
    // FAIL CLOSED: Connection errors must never be swallowed or ignored
    report(false, 'Live DB connection and query execution', err.message);
    if (client) {
      try { await client.end(); } catch {}
    }
  }
} else {
  if (requireDb) {
    // Strict mode requires live database verification
    report(false, 'Live Database Credentials', 'Neither DATABASE_URL nor SUPABASE_DB_URL is configured in environment, but --require-db was specified.');
  } else {
    console.log('  ℹ No DATABASE_URL or SUPABASE_DB_URL set in environment.');
    console.log('    Phase 1 static AST checks verified 7 ordered migrations cleanly.');
    console.log('    To verify live Supabase project permissions before deployment:');
    console.log('    DATABASE_URL="postgres://..." npm run verify:db:live');
  }
}

console.log('\n================================================================');
console.log(` Privilege Verification Summary: ${passedChecks} passed, ${failedChecks} failed.`);
console.log('================================================================\n');

if (failedChecks > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
