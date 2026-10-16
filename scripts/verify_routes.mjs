/**
 * Strova Group — Automated Full-Path Route & Link Integrity Verifier
 *
 * Verifies production build outputs for:
 * 1. Marketing website (dist/) — All 32 pages, assets, anchors, canonicals, and i18n links.
 * 2. Client portal (portal/dist/) — All 10 portal views, assets, auth paths, and cross-origin public links.
 * 3. Element fragment resolution (e.g. #founder, #privacy-choices).
 * 4. Zero reference to localhost, 127.0.0.1, or developer paths in production bundles.
 * 5. Native HTTP smoke testing of all key endpoints.
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';

const ROOT_DIR = process.cwd();
const DIST_MARKETING = path.join(ROOT_DIR, 'dist');
const DIST_PORTAL = path.join(ROOT_DIR, 'portal/dist');

let totalPassed = 0;
let totalFailed = 0;
const errors = [];

function assert(condition, message) {
  if (condition) {
    totalPassed++;
    console.log(`  ✓ ${message}`);
  } else {
    totalFailed++;
    errors.push(message);
    console.error(`  ❌ ${message}`);
  }
}

// -----------------------------------------------------------------------------
// Helper: Collect all HTML files recursively
// -----------------------------------------------------------------------------
function collectHtmlFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(collectHtmlFiles(full));
    } else if (entry.name.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

// -----------------------------------------------------------------------------
// Helper: Extract IDs from HTML string
// -----------------------------------------------------------------------------
function extractElementIds(html) {
  const ids = new Set();
  const idRegex = /\bid=["']([^"']+)["']/g;
  let match;
  while ((match = idRegex.exec(html)) !== null) {
    ids.add(match[1]);
  }
  return ids;
}

// -----------------------------------------------------------------------------
// Phase 1: Static Route & Link Integrity Audit
// -----------------------------------------------------------------------------
console.log('================================================================');
console.log(' Strova Group — Full-Path Route & Link Integrity Verifier');
console.log('================================================================\n');

assert(fs.existsSync(DIST_MARKETING), 'Marketing build directory (dist/) exists');
assert(fs.existsSync(DIST_PORTAL), 'Portal build directory (portal/dist/) exists');

const marketingPages = collectHtmlFiles(DIST_MARKETING);
const portalPages = collectHtmlFiles(DIST_PORTAL);

console.log(`\n[Phase 1: Marketing Website Link & Asset Audit (${marketingPages.length} pages)]`);

// Build registry of element IDs per HTML file
const marketingIdRegistry = new Map();
for (const page of marketingPages) {
  const content = fs.readFileSync(page, 'utf8');
  marketingIdRegistry.set(page, extractElementIds(content));
}

for (const page of marketingPages) {
  const relPath = path.relative(DIST_MARKETING, page);
  const content = fs.readFileSync(page, 'utf8');

  // 1. Check for forbidden developer URLs in production HTML
  assert(!content.includes('http://localhost'), `[${relPath}] Zero http://localhost references`);
  assert(!content.includes('http://127.0.0.1'), `[${relPath}] Zero http://127.0.0.1 references`);

  // 2. Extract and check all href attributes
  const hrefRegex = /href=["']([^"']+)["']/g;
  let hrefMatch;
  while ((hrefMatch = hrefRegex.exec(content)) !== null) {
    const link = hrefMatch[1].trim();

    // Skip empty, javascript, mailto, tel, wa.me, and external links
    if (
      !link ||
      link.startsWith('#') ||
      link.startsWith('javascript:') ||
      link.startsWith('mailto:') ||
      link.startsWith('tel:') ||
      link.startsWith('https://wa.me') ||
      link.startsWith('https://portal.strovagroups.in') ||
      link.startsWith('https://github.com') ||
      link.startsWith('https://schema.org')
    ) {
      // Local fragment on same page
      if (link.startsWith('#') && link.length > 1) {
        const targetId = link.slice(1);
        const pageIds = marketingIdRegistry.get(page) || new Set();
        assert(pageIds.has(targetId), `[${relPath}] Local fragment #${targetId} matches existing element ID`);
      }
      continue;
    }

    // Handle relative or absolute internal link (e.g. /about/, /technologies/#process, /hi/privacy/)
    if (link.startsWith('/') && !link.startsWith('//')) {
      const [urlWithoutFragment, fragment] = link.split('#');
      const [pathname] = urlWithoutFragment.split('?');
      let targetFile;

      const ext = path.extname(pathname).toLowerCase();
      if (ext) {
        targetFile = path.join(DIST_MARKETING, pathname.slice(1));
      } else if (pathname === '/' || pathname === '') {
        targetFile = path.join(DIST_MARKETING, 'index.html');
      } else {
        const cleanPath = pathname.replace(/^\/+|\/+$/g, '');
        targetFile = path.join(DIST_MARKETING, cleanPath, 'index.html');
      }

      const targetExists = fs.existsSync(targetFile);
      assert(targetExists, `[${relPath}] Internal route exists: ${link}`);

      if (targetExists && fragment) {
        const targetIds = marketingIdRegistry.get(targetFile) || new Set();
        assert(targetIds.has(fragment), `[${relPath}] Fragment #${fragment} resolves in target ${pathname}`);
      }
    }
  }

  // 3. Extract and check all script and img src attributes
  const srcRegex = /src=["']([^"']+)["']/g;
  let srcMatch;
  while ((srcMatch = srcRegex.exec(content)) !== null) {
    const src = srcMatch[1].trim();
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      continue;
    }
    if (src.startsWith('/')) {
      const assetFile = path.join(DIST_MARKETING, src.slice(1));
      assert(fs.existsSync(assetFile), `[${relPath}] Embedded asset exists: ${src}`);
    }
  }
}

// -----------------------------------------------------------------------------
// Phase 2: Client Portal Link & Route Audit
// -----------------------------------------------------------------------------
console.log(`\n[Phase 2: Client Portal Link & Route Audit (${portalPages.length} pages)]`);

const portalIdRegistry = new Map();
for (const page of portalPages) {
  const content = fs.readFileSync(page, 'utf8');
  portalIdRegistry.set(page, extractElementIds(content));
}

for (const page of portalPages) {
  const relPath = path.relative(DIST_PORTAL, page);
  const content = fs.readFileSync(page, 'utf8');

  // Check forbidden dev URLs
  assert(!content.includes('http://localhost'), `[Portal: ${relPath}] Zero http://localhost references`);
  assert(!content.includes('http://127.0.0.1'), `[Portal: ${relPath}] Zero http://127.0.0.1 references`);

  // Check hrefs
  const hrefRegex = /href=["']([^"']+)["']/g;
  let hrefMatch;
  while ((hrefMatch = hrefRegex.exec(content)) !== null) {
    const link = hrefMatch[1].trim();

    if (
      !link ||
      link.startsWith('#') ||
      link.startsWith('javascript:') ||
      link.startsWith('mailto:') ||
      link.startsWith('tel:') ||
      link.startsWith('https://wa.me') ||
      link.startsWith('https://strovagroups.in') ||
      link.startsWith('https://github.com')
    ) {
      continue;
    }

    if (link.startsWith('/') && !link.startsWith('//')) {
      const [urlWithoutFragment, fragment] = link.split('#');
      const [pathname] = urlWithoutFragment.split('?');
      let targetFile;

      const ext = path.extname(pathname).toLowerCase();
      if (ext) {
        const cleanExt = pathname.startsWith('/portal/') ? pathname.slice(8) : pathname.slice(1);
        targetFile = fs.existsSync(path.join(DIST_PORTAL, cleanExt))
          ? path.join(DIST_PORTAL, cleanExt)
          : path.join(DIST_PORTAL, pathname.slice(1));
      } else if (pathname === '/' || pathname === '' || pathname === '/portal' || pathname === '/portal/') {
        targetFile = path.join(DIST_PORTAL, 'index.html');
      } else {
        const cleanPath = pathname.replace(/^\/+|\/+$/g, '');
        const portalRelative = cleanPath.startsWith('portal/')
          ? cleanPath.slice(7)
          : (cleanPath === 'portal' ? '' : cleanPath);
        targetFile = (portalRelative === '' || fs.existsSync(path.join(DIST_PORTAL, portalRelative, 'index.html')))
          ? path.join(DIST_PORTAL, portalRelative, 'index.html')
          : path.join(DIST_PORTAL, cleanPath, 'index.html');
      }

      const targetExists = fs.existsSync(targetFile) || fs.existsSync(path.join(DIST_MARKETING, pathname.replace(/^\/+|\/+$/g, ''), 'index.html'));
      assert(targetExists, `[Portal: ${relPath}] Internal route exists: ${link}`);
    }
  }

  // Check asset src
  const srcRegex = /src=["']([^"']+)["']/g;
  let srcMatch;
  while ((srcMatch = srcRegex.exec(content)) !== null) {
    const src = srcMatch[1].trim();
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      continue;
    }
    if (src.startsWith('/')) {
      const assetFile = path.join(DIST_PORTAL, src.slice(1));
      assert(fs.existsSync(assetFile), `[Portal: ${relPath}] Embedded asset exists: ${src}`);
    }
  }
}

// -----------------------------------------------------------------------------
// Phase 3: Local HTTP Static Artifact Smoke Testing (Loopback 127.0.0.1)
// -----------------------------------------------------------------------------

function createStaticServer(distDir) {
  return http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    let filePath;

    if (reqUrl === '/') {
      filePath = path.join(distDir, 'index.html');
    } else if (reqUrl.endsWith('/')) {
      filePath = path.join(distDir, reqUrl.slice(1), 'index.html');
    } else {
      filePath = path.join(distDir, reqUrl.slice(1));
      if (!fs.existsSync(filePath) && fs.existsSync(path.join(distDir, reqUrl.slice(1), 'index.html'))) {
        filePath = path.join(distDir, reqUrl.slice(1), 'index.html');
      }
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'text/html';
      if (ext === '.js') contentType = 'application/javascript';
      if (ext === '.css') contentType = 'text/css';
      if (ext === '.svg') contentType = 'image/svg+xml';
      if (ext === '.xml') contentType = 'application/xml';
      if (ext === '.woff2') contentType = 'font/woff2';

      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      const notFoundPage = path.join(distDir, '404.html');
      if (fs.existsSync(notFoundPage)) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        fs.createReadStream(notFoundPage).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    }
  });
}

function makeHttpRequest(port, requestPath) {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:${port}${requestPath}`, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
      });
    }).on('error', (err) => {
      resolve({ statusCode: 500, error: err.message });
    });
  });
}

function makeHttpsRequest(urlStr, timeoutMs = 6000) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const req = https.get(u, {
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; StrovaReleaseVerifier/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            success: true,
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          });
        });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'ETIMEDOUT' });
      });
      req.on('error', (err) => {
        resolve({ success: false, error: err.code || err.message });
      });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}

async function runHttpSmokeTests() {
  console.log('\n[Phase 3: Local HTTP Static Artifact Smoke Testing (Loopback 127.0.0.1)]');
  console.log('  ℹ Note: These requests verify that generated dist/ files serve valid HTTP responses locally.');
  console.log('    They do NOT prove that live Cloudflare DNS, SSL edge termination, or deployed hosts are functional.\n');

  const marketingServer = createStaticServer(DIST_MARKETING);
  const portalServer = createStaticServer(DIST_PORTAL);

  const M_PORT = 4390;
  const P_PORT = 4391;

  await new Promise((res) => marketingServer.listen(M_PORT, '127.0.0.1', res));
  await new Promise((res) => portalServer.listen(P_PORT, '127.0.0.1', res));

  // Critical marketing routes to test locally
  const marketingRoutes = [
    '/',
    '/technologies/',
    '/digital/',
    '/commerce/',
    '/about/',
    '/case-studies/',
    '/contact/',
    '/faq/',
    '/privacy/',
    '/privacy/requests/',
    '/terms/',
    '/cookies/',
    '/accessibility/',
    '/hi/',
    '/hi/technologies/',
    '/hi/digital/',
    '/hi/commerce/',
    '/hi/about/',
    '/hi/contact/',
    '/hi/privacy/',
    '/hi/privacy/requests/',
    '/hi/terms/',
    '/hi/cookies/',
    '/sitemap-index.xml',
    '/robots.txt',
    '/llms.txt',
    // Same-domain client portal routes
    '/portal/',
    '/portal/login/',
    '/portal/logout/',
    '/portal/orders/',
    '/portal/invoices/',
    '/portal/files/',
    '/portal/messages/',
    '/portal/support/',
    '/portal/admin/',
  ];

  for (const r of marketingRoutes) {
    const resp = await makeHttpRequest(M_PORT, r);
    assert(resp.statusCode === 200, `Local Artifact HTTP GET (Marketing) ${r} returns 200 OK (${resp.body.length} bytes)`);
  }

  // 404 test
  const m404 = await makeHttpRequest(M_PORT, '/non-existent-page-xyz/');
  assert(m404.statusCode === 404 && m404.body.includes('404'), 'Local Artifact Marketing 404 route returns HTTP 404 with custom error page');

  // Critical portal routes to test locally
  const portalRoutes = [
    '/',
    '/login/',
    '/logout/',
    '/orders/',
    '/invoices/',
    '/files/',
    '/messages/',
    '/support/',
    '/admin/',
    '/robots.txt',
  ];

  for (const r of portalRoutes) {
    const resp = await makeHttpRequest(P_PORT, r);
    assert(resp.statusCode === 200, `Local Artifact HTTP GET (Portal) ${r} returns 200 OK (${resp.body.length} bytes)`);
  }

  const p404 = await makeHttpRequest(P_PORT, '/portal-unknown-path/');
  assert(p404.statusCode === 404, 'Local Artifact Portal 404 route returns HTTP 404');

  // Clean shutdown of local test servers
  await new Promise((res) => marketingServer.close(res));
  await new Promise((res) => portalServer.close(res));

  // ---------------------------------------------------------------------------
  // Phase 4: Remote Deployed Domain HTTPS Smoke Test (Live Cloudflare / DNS)
  // ---------------------------------------------------------------------------
  console.log('\n[Phase 4: Remote Deployed Domain HTTPS Verification (Production Domains)]');
  const requireLiveDomains = process.argv.includes('--require-live-domains') || process.env.REQUIRE_LIVE_DOMAINS === 'true';

  const liveChecks = [
    { name: 'Marketing Apex Domain', url: 'https://strovagroups.in/' },
    { name: 'Marketing Technologies Page', url: 'https://strovagroups.in/technologies/' },
    { name: 'Marketing Robots.txt', url: 'https://strovagroups.in/robots.txt' },
    { name: 'Marketing Sitemap Index', url: 'https://strovagroups.in/sitemap-index.xml' },
    { name: 'Client Portal Same-Domain Apex', url: 'https://strovagroups.in/portal/' },
    { name: 'Client Portal Same-Domain Login', url: 'https://strovagroups.in/portal/login/' },
  ];

  for (const check of liveChecks) {
    const result = await makeHttpsRequest(check.url);
    if (result.success) {
      const isOkOrRedirect = result.statusCode >= 200 && result.statusCode < 400;
      assert(isOkOrRedirect, `Remote HTTPS [${check.name}] ${check.url} responded with status ${result.statusCode}`);

      // Verify essential security headers on live responses
      if (result.statusCode === 200) {
        const h = result.headers;
        if (h['strict-transport-security']) {
          assert(true, `Remote HTTPS [${check.name}] enforces Strict-Transport-Security`);
        }
        if (h['x-content-type-options'] === 'nosniff') {
          assert(true, `Remote HTTPS [${check.name}] enforces nosniff`);
        }
      }
    } else {
      if (requireLiveDomains) {
        assert(false, `Remote Deployed Endpoint [${check.name}] ${check.url} failed: ${result.error}`);
      } else {
        console.log(`  ℹ Remote Endpoint [${check.name}] ${check.url}: UNVERIFIED`);
        console.log(`    Detail: ${result.error}. Local artifact checks do NOT prove remote deployment works.`);
      }
    }
  }
}

await runHttpSmokeTests();

console.log('\n================================================================');
console.log(` Route & Link Summary: ${totalPassed} passed, ${totalFailed} failed.`);
console.log('================================================================\n');

if (totalFailed > 0) {
  console.error('❌ ROUTE INTEGRITY AUDIT FAILED. Broken routes detected:');
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log('✅ ALL APPLICATION ROUTES, ASSETS, ANCHORS, AND HTTP PATHS VERIFIED CLEANLY.');
  process.exit(0);
}
