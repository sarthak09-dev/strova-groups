/**
 * Strova Group — Automated Favicon & Google Search Icon Verifier
 *
 * Checks implementation against Google Search Favicon specifications:
 * https://developers.google.com/search/docs/appearance/favicon-in-search
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const ROBOTS_FILE = path.join(PUBLIC_DIR, 'robots.txt');

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    errors.push(message);
    console.error(`  ❌ ${message}`);
  }
}

async function verify() {
  console.log('================================================================');
  console.log(' Strova Group — Favicon & Google Search Eligibility Verifier');
  console.log('================================================================\n');

  // 1. Verify Public Favicon Files
  console.log('[Phase 1: Favicon Asset Format & Dimension Verification]');

  const iconChecks = [
    { file: 'favicon.png', width: 96, height: 96, format: 'png', desc: 'Google Search Recommended 96x96 PNG' },
    { file: 'favicon-96x96.png', width: 96, height: 96, format: 'png', desc: 'Canonical 96x96 PNG' },
    { file: 'favicon-48x48.png', width: 48, height: 48, format: 'png', desc: 'Baseline 48x48 PNG (multiple of 48)' },
    { file: 'apple-touch-icon.png', width: 180, height: 180, format: 'png', desc: 'Apple Touch 180x180 PNG' },
    { file: 'favicon-192x192.png', width: 192, height: 192, format: 'png', desc: 'PWA 192x192 PNG' },
    { file: 'favicon-512x512.png', width: 512, height: 512, format: 'png', desc: 'PWA Splash 512x512 PNG' },
  ];

  for (const check of iconChecks) {
    const fullPath = path.join(PUBLIC_DIR, check.file);
    assert(fs.existsSync(fullPath), `${check.file} exists on disk`);
    if (fs.existsSync(fullPath)) {
      const meta = await sharp(fullPath).metadata();
      assert(meta.format === check.format, `${check.file} is valid ${check.format.toUpperCase()} format`);
      assert(meta.width === check.width && meta.height === check.height, `${check.file} has exact ${check.width}x${check.height} dimensions (${check.desc})`);
      assert(meta.width === meta.height, `${check.file} is strictly 1:1 square`);
      assert(
        meta.width % 48 === 0 || check.file === 'apple-touch-icon.png' || check.file === 'favicon-512x512.png',
        `${check.file} width (${meta.width}px) is a multiple of 48px or valid device/PWA icon`
      );
    }
  }

  // Check favicon.svg
  const svgPath = path.join(PUBLIC_DIR, 'favicon.svg');
  assert(fs.existsSync(svgPath), 'favicon.svg exists on disk');
  if (fs.existsSync(svgPath)) {
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    assert(svgContent.includes('<svg') && svgContent.includes('xmlns="http://www.w3.org/2000/svg"'), 'favicon.svg has valid SVG xmlns');
    assert(svgContent.includes('viewBox="0 0 36 36"'), 'favicon.svg has 1:1 square viewBox');
    assert(svgContent.includes('#0F172A'), 'favicon.svg contains brand background #0F172A');
    assert(svgContent.includes('#3B82F6'), 'favicon.svg contains brand accent #3B82F6');
  }

  // Check favicon.ico
  const icoPath = path.join(PUBLIC_DIR, 'favicon.ico');
  assert(fs.existsSync(icoPath), 'favicon.ico exists on disk');
  if (fs.existsSync(icoPath)) {
    const buf = fs.readFileSync(icoPath);
    assert(buf.length > 0, `favicon.ico is non-empty (${buf.length} bytes)`);
    assert(buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1, 'favicon.ico has valid ICO magic header');
    const imageCount = buf.readUInt16LE(4);
    assert(imageCount >= 1, `favicon.ico contains ${imageCount} embedded icon image(s)`);
  }

  // Check site.webmanifest
  console.log('\n[Phase 2: Web App Manifest Icons Verification]');
  const manifestPath = path.join(PUBLIC_DIR, 'site.webmanifest');
  assert(fs.existsSync(manifestPath), 'site.webmanifest exists');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      assert(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'site.webmanifest defines icons array');
      for (const icon of manifest.icons || []) {
        const iconFile = path.join(PUBLIC_DIR, icon.src.replace(/^\//, ''));
        assert(fs.existsSync(iconFile), `Manifest icon ${icon.src} resolves to real file`);
      }
    } catch (e) {
      assert(false, `site.webmanifest is valid JSON: ${e.message}`);
    }
  }

  // Check robots.txt crawlability
  console.log('\n[Phase 3: Robots.txt & Googlebot Crawlability Audit]');
  assert(fs.existsSync(ROBOTS_FILE), 'robots.txt exists');
  if (fs.existsSync(ROBOTS_FILE)) {
    const robots = fs.readFileSync(ROBOTS_FILE, 'utf8');
    assert(!robots.includes('Disallow: /favicon'), 'robots.txt does not block /favicon*');
    assert(!robots.includes('Disallow: /apple-touch-icon'), 'robots.txt does not block /apple-touch-icon*');
    assert(robots.includes('Allow: /'), 'robots.txt has Allow: / directive for root assets');
  }

  // 4. Built HTML Output Verification
  console.log('\n[Phase 4: Production Build HTML Favicon Link Verification]');
  const homeHtmlPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(homeHtmlPath)) {
    const html = fs.readFileSync(homeHtmlPath, 'utf8');
    
    // Check primary 96x96 PNG favicon
    assert(
      html.includes('rel="icon"') && html.includes('type="image/png"') && html.includes('sizes="96x96"') && html.includes('href="/favicon.png"'),
      'dist/index.html includes primary Google Search <link rel="icon" type="image/png" sizes="96x96" href="/favicon.png" />'
    );

    // Check SVG favicon
    assert(
      html.includes('rel="icon"') && html.includes('type="image/svg+xml"') && html.includes('href="/favicon.svg"'),
      'dist/index.html includes vector <link rel="icon" type="image/svg+xml" href="/favicon.svg" />'
    );

    // Check ICO shortcut icon
    assert(
      html.includes('rel="shortcut icon"') && html.includes('href="/favicon.ico"'),
      'dist/index.html includes legacy fallback <link rel="shortcut icon" href="/favicon.ico" />'
    );

    // Check Apple Touch icon
    assert(
      html.includes('rel="apple-touch-icon"') && html.includes('href="/apple-touch-icon.png"'),
      'dist/index.html includes <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />'
    );

    // Check that every declared href in dist exists in dist/
    const iconHrefRegex = /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/g;
    let match;
    while ((match = iconHrefRegex.exec(html)) !== null) {
      const href = match[1];
      const distFile = path.join(DIST_DIR, href.replace(/^\//, ''));
      assert(fs.existsSync(distFile), `Declared icon link href="${href}" exists in dist/`);
    }

    // Check for duplicate rel="icon" type="image/png" declarations
    const pngFaviconMatches = html.match(/<link[^>]+rel=["']icon["'][^>]+type=["']image\/png["'][^>]*>/g) || [];
    assert(pngFaviconMatches.length === 1, `dist/index.html has exactly 1 PNG icon declaration (found ${pngFaviconMatches.length})`);
  } else {
    console.log('  ℹ dist/index.html not yet built (run npm run build first)');
  }

  console.log('\n================================================================');
  console.log(` Summary: ${passed} passed, ${failed} failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    console.error('Validation failures:');
    for (const err of errors) {
      console.error(` - ${err}`);
    }
    process.exit(1);
  }
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
