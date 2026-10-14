#!/usr/bin/env node
/**
 * Strova Group — Strict Dependency Vulnerability Audit Gate
 *
 * Enforces zero-tolerance vulnerability policy across production and dev dependencies.
 * Only explicit, narrowly documented advisories that have verified static mitigations
 * are permitted. Any unapproved, new, or third-party dependency vulnerabilities
 * strictly fail the audit and CI workflow with exit code 1.
 *
 * Specific narrow exception:
 * - Astro <= 7.2.7 upstream framework advisories:
 *   - GHSA-2pvr-wf23-7pc7 (Astro host-header SSRF in prerendered error page fetch)
 *     Exposure is specific to node/SSR runtime deployments where dynamic error fetches rely on
 *     untrusted host headers. Strova Group is compiled exclusively with `output: "static"` and deployed
 *     to Cloudflare Pages edge storage without any node SSR server runtime.
 *   - Other Astro framework advisories with zero surface exposure in static prerendering.
 */

import { execSync } from 'node:child_process';

console.log('================================================================');
console.log(' Strova Group — Strict Dependency Audit Gate');
console.log('================================================================\n');

// Zero-tolerance policy: No advisory exceptions are active. All dependencies must be fully patched.
const APPROVED_STATIC_ADVISORIES = new Map();

let auditOutput = '';
try {
  auditOutput = execSync('npm audit --json', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (err) {
  // npm audit exits with code 1 if any vulnerabilities exist
  auditOutput = err.stdout || '';
}

if (!auditOutput) {
  console.error('❌ Failed to obtain npm audit JSON output.');
  process.exit(1);
}

let report;
try {
  report = JSON.parse(auditOutput);
} catch (e) {
  console.error('❌ Failed to parse npm audit JSON output:', e.message);
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities || {};
const vulnKeys = Object.keys(vulnerabilities);

if (vulnKeys.length === 0) {
  console.log('✅ STRICT AUDIT PASSED: Zero vulnerabilities found in dependency tree.');
  process.exit(0);
}

let unapprovedViolations = [];
let approvedExceptions = [];

for (const pkgName of vulnKeys) {
  const vuln = vulnerabilities[pkgName];
  const viaList = Array.isArray(vuln.via) ? vuln.via : [vuln.via];

  for (const item of viaList) {
    if (typeof item === 'string') {
      // Transitive dependency reference
      continue;
    }

    const advisoryUrl = item.url;
    if (pkgName === 'astro' && advisoryUrl && APPROVED_STATIC_ADVISORIES.has(advisoryUrl)) {
      approvedExceptions.push({
        package: pkgName,
        url: advisoryUrl,
        title: item.title,
        severity: item.severity,
        mitigation: APPROVED_STATIC_ADVISORIES.get(advisoryUrl).mitigation,
      });
    } else {
      unapprovedViolations.push({
        package: pkgName,
        url: advisoryUrl || 'N/A',
        title: item.title || item.name || 'Unspecified vulnerability',
        severity: item.severity || vuln.severity,
        range: item.range || vuln.range,
      });
    }
  }
}

// Print approved exceptions
if (approvedExceptions.length > 0) {
  console.log(`[Documented & Approved Static Architecture Exceptions (${approvedExceptions.length})]:`);
  for (const exp of approvedExceptions) {
    console.log(`  ℹ [${exp.severity.toUpperCase()}] ${exp.package}: ${exp.title}`);
    console.log(`    URL: ${exp.url}`);
    console.log(`    Rationale: ${exp.mitigation}`);
  }
  console.log();
}

// Print unapproved violations
if (unapprovedViolations.length > 0) {
  console.error(`❌ STRICT AUDIT REJECTED: Found ${unapprovedViolations.length} UNAPPROVED dependency vulnerabilities:`);
  for (const v of unapprovedViolations) {
    console.error(`  ✗ [${v.severity.toUpperCase()}] ${v.package}: ${v.title}`);
    console.error(`    URL: ${v.url}`);
    console.error(`    Range: ${v.range}`);
  }
  console.error('\nRelease gate FAILED: Any new or third-party dependency vulnerabilities must be resolved or remediated.');
  process.exit(1);
}

console.log('================================================================');
console.log('✅ STRICT DEPENDENCY AUDIT PASSED:');
console.log(`   All ${approvedExceptions.length} findings belong strictly to the documented Astro static output allowlist.`);
console.log('   Zero unapproved or third-party dependency vulnerabilities exist.');
console.log('================================================================\n');
process.exit(0);

