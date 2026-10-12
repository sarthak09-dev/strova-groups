import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');

function getAllHtmlFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllHtmlFiles(fullPath));
    } else if (file.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

const htmlFiles = getAllHtmlFiles(distDir);
console.log(`Found ${htmlFiles.length} HTML files in dist/:\n`);

let errors = [];
let warnings = [];

// Helper regex extractors
const getTagContent = (html, regex) => {
  const m = html.match(regex);
  return m ? m[1] : null;
};

const getAllMatches = (html, regex) => {
  return [...html.matchAll(regex)];
};

for (const filePath of htmlFiles) {
  const relPath = path.relative(distDir, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`Auditing: ${relPath}`);

  // 1. One H1 per page
  const h1Matches = getAllMatches(content, /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi);
  if (h1Matches.length === 0) {
    errors.push(`[${relPath}] Missing <h1> tag`);
  } else if (h1Matches.length > 1) {
    errors.push(`[${relPath}] Multiple <h1> tags found (${h1Matches.length})`);
  }

  // 2. Title tag (< 60 chars strictly)
  const title = getTagContent(content, /<title>([\s\S]*?)<\/title>/i);
  if (!title) {
    errors.push(`[${relPath}] Missing <title> tag`);
  } else {
    const plainTitle = title.replace(/&amp;/g, '&').replace(/&#38;/g, '&');
    if (plainTitle.length > 60) {
      errors.push(`[${relPath}] Title length is ${plainTitle.length} (> 60 chars): "${plainTitle}"`);
    }
  }

  // 3. Meta description (< 160 chars strictly)
  const metaDescMatch = content.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  if (!metaDescMatch) {
    errors.push(`[${relPath}] Missing meta description`);
  } else {
    const desc = metaDescMatch[1].replace(/&amp;/g, '&').replace(/&#38;/g, '&');
    if (desc.length > 160) {
      errors.push(`[${relPath}] Meta description length is ${desc.length} (> 160 chars): "${desc}"`);
    }
  }

  // 4. Canonical link
  const canonicalMatch = content.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i);
  if (!canonicalMatch) {
    errors.push(`[${relPath}] Missing canonical link`);
  } else {
    const canonical = canonicalMatch[1];
    if (!canonical.startsWith('https://strovagroups.in')) {
      errors.push(`[${relPath}] Canonical does not start with https://strovagroups.in: "${canonical}"`);
    }
  }

  // 5. Hreflang tags
  if (!relPath.includes('404')) {
    const hreflangs = getAllMatches(content, /<link\s+rel="alternate"\s+hreflang="([^"]*)"\s+href="([^"]*)"/gi);
    const langs = hreflangs.map(m => m[1]);
    if (!langs.includes('en') || !langs.includes('en-IN') || !langs.includes('x-default')) {
      errors.push(`[${relPath}] Missing required hreflang (found: ${langs.join(', ')})`);
    }
  }

  // 6. JSON-LD structured data validation
  const jsonLdScripts = getAllMatches(content, /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
  if (jsonLdScripts.length === 0 && !relPath.includes('404')) {
    errors.push(`[${relPath}] Missing JSON-LD structured data`);
  }
  for (const script of jsonLdScripts) {
    try {
      const parsed = JSON.parse(script[1]);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item['@context'] || !item['@type']) {
          errors.push(`[${relPath}] Invalid JSON-LD item structure: missing @context or @type`);
        }
        if (item['@type'] === 'Organization') {
          if (item.legalName !== 'Strova Group' && item.name !== 'Strova Group') {
            errors.push(`[${relPath}] Organization schema missing valid name/legalName: ${item.name || item.legalName}`);
          }
          if (item.url !== 'https://strovagroups.in') {
            errors.push(`[${relPath}] Organization schema invalid url: ${item.url}`);
          }
          if (!item.founder || (!JSON.stringify(item.founder).includes('Sarthak Shresht') && !JSON.stringify(item.founder).includes('Babita Kumari'))) {
            errors.push(`[${relPath}] Organization schema missing founder Sarthak Shresht / Babita Kumari`);
          }
          if (item.telephone !== '+919288077802') {
            errors.push(`[${relPath}] Organization schema missing telephone +919288077802`);
          }
          if (item.email !== 'info@strovagroups.in') {
            errors.push(`[${relPath}] Organization schema missing email info@strovagroups.in`);
          }
        }
      }
    } catch (e) {
      errors.push(`[${relPath}] Malformed JSON-LD: ${e.message}`);
    }
  }

  // 6b. Brand Name Check: Brand must be "Strova Group", never bare "Strova"
  if (title && /^Strova\s*—/i.test(title)) {
    errors.push(`[${relPath}] Page title uses bare 'Strova' instead of 'Strova Group': "${title}"`);
  }

  // 6c. Zero Public Pricing & Zero Dark Pattern Check
  // Extract text outside script and style tags to check for price numbers and forbidden currency symbols
  const bodyText = content.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (bodyText.includes('₹') || bodyText.includes('starting from') || bodyText.includes('Starting from')) {
    errors.push(`[${relPath}] Prohibited price text or rupee symbol found on rendered page`);
  }

  // 7. Check for old strings & anti-patterns
  if (content.includes('strovagroup.com')) {
    errors.push(`[${relPath}] Contains old domain: strovagroup.com`);
  }
  if (content.includes('hello@strovagroup.com')) {
    errors.push(`[${relPath}] Contains old email: hello@strovagroup.com`);
  }
  if (content.includes('privacy@strovagroup.com')) {
    errors.push(`[${relPath}] Contains old privacy email: privacy@strovagroup.com`);
  }
  if (content.includes('91XXXXXXXXXX')) {
    errors.push(`[${relPath}] Contains unreplaced phone placeholder: 91XXXXXXXXXX`);
  }
  if (content.includes('UDYAMXXXXXXXXXX')) {
    errors.push(`[${relPath}] Contains unreplaced Udyam placeholder: UDYAMXXXXXXXXXX`);
  }
  if (content.includes('section-kicker')) {
    errors.push(`[${relPath}] Prohibited anti-pattern: section-kicker class found`);
  }
  if (content.includes('reveal-on-scroll')) {
    errors.push(`[${relPath}] Prohibited anti-pattern: reveal-on-scroll class found (violates "no fade-up on every block")`);
  }

  // 8. Remote CDN assets prohibition
  const cdnRegex = /(fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com)/i;
  if (cdnRegex.test(content)) {
    errors.push(`[${relPath}] Contains external CDN asset reference`);
  }

  // 9. Trust facts presence on every standard page (Header and Footer)
  if (!relPath.includes('404')) {
    // Prohibited placeholders (Absolute Rules: no bracket placeholders or TODO markers allowed)
    const prohibitedPlaceholders = [
      '[ADDRESS]',
      '[ROLE TITLE]',
      '[UDYAM NO. when issued]',
      '[UDYAM NO.]',
      'TODO',
      'Notice for Legal Review',
      'Lorem',
    ];
    for (const placeholder of prohibitedPlaceholders) {
      if (content.includes(placeholder)) {
        errors.push(`[${relPath}] Prohibited placeholder found: "${placeholder}"`);
      }
    }

    // Required trust facts presence on every standard page
    if (!content.includes('info@strovagroups.in')) {
      errors.push(`[${relPath}] Missing contact email info@strovagroups.in`);
    }
    if (!content.includes('+91 92880 77802')) {
      errors.push(`[${relPath}] Missing telephone +91 92880 77802`);
    }
    if (!content.includes('https://wa.me/919288077802')) {
      errors.push(`[${relPath}] Missing WhatsApp link https://wa.me/919288077802`);
    }
    if (!content.includes('UDYAM-JH-20-0147452')) {
      errors.push(`[${relPath}] Missing confirmed MSME Udyam registration number UDYAM-JH-20-0147452`);
    }
    if (!content.includes('10:00 AM – 7:00 PM IST')) {
      errors.push(`[${relPath}] Missing business operating hours 10:00 AM – 7:00 PM IST`);
    }

    // Theme toggle accessibility
    if (!content.includes('id="theme-toggle"')) {
      errors.push(`[${relPath}] Missing desktop theme toggle button (#theme-toggle)`);
    }
    if (!content.includes('id="mobile-theme-toggle"')) {
      errors.push(`[${relPath}] Missing mobile theme toggle button (#mobile-theme-toggle)`);
    }

    // Pre-hydration theme script
    if (!content.includes('localStorage.getItem(\'strova-theme\')')) {
      errors.push(`[${relPath}] Missing inline pre-hydration theme script in <head>`);
    }
  }

  // 10. Skip link
  if (!content.includes('class="skip-link"')) {
    errors.push(`[${relPath}] Missing accessible skip link`);
  }

  // 11. Images have alt attributes
  const imgMatches = getAllMatches(content, /<img\b([^>]*)>/gi);
  for (const img of imgMatches) {
    if (!img[1].includes('alt="')) {
      errors.push(`[${relPath}] Image missing alt attribute: ${img[0]}`);
    }
  }

  // 12. Check internal anchor links
  const anchorMatches = getAllMatches(content, /<a\b[^>]*\bhref="([^"]*)"/gi);
  for (const anchor of anchorMatches) {
    const href = anchor[1];
    // Skip external links, tel:, mailto:, in-page hashes, etc.
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('tel:') || href.startsWith('mailto:') || href.startsWith('#')) {
      continue;
    }
    // Clean path and query/hash
    const cleanPath = href.split('?')[0].split('#')[0];
    if (!cleanPath) continue;

    let targetFile;
    if (cleanPath.endsWith('/')) {
      targetFile = path.join(distDir, cleanPath.slice(1), 'index.html');
    } else if (cleanPath === '/') {
      targetFile = path.join(distDir, 'index.html');
    } else if (path.extname(cleanPath)) {
      targetFile = path.join(distDir, cleanPath.slice(1));
    } else {
      targetFile = path.join(distDir, cleanPath.slice(1), 'index.html');
    }

    if (!fs.existsSync(targetFile)) {
      errors.push(`[${relPath}] Broken internal link: "${href}" -> target file not found: ${targetFile}`);
    }
  }
}

// 13. Verify font self-hosting
const fontsDir = path.join(__dirname, 'public', 'fonts');
if (!fs.existsSync(fontsDir) || fs.readdirSync(fontsDir).length === 0) {
  errors.push('Self-hosted fonts directory missing or empty: public/fonts/');
} else {
  const fontFiles = fs.readdirSync(fontsDir);
  console.log(`Self-hosted fonts found in public/fonts/: ${fontFiles.join(', ')}`);
}

// 14. Check JS bundle sizes
const astroDir = path.join(distDir, '_astro');
let nonThreeTotal = 0;
if (fs.existsSync(astroDir)) {
  const jsFiles = fs.readdirSync(astroDir).filter(f => f.endsWith('.js'));
  console.log('\n--- JavaScript Bundles in dist/_astro/ ---');
  for (const f of jsFiles) {
    const fullP = path.join(astroDir, f);
    const size = fs.statSync(fullP).size;
    console.log(`  ${f}: ${(size / 1024).toFixed(2)} KB raw`);
    if (!f.includes('three')) {
      nonThreeTotal += size;
    }
  }
  const nonThreeKB = (nonThreeTotal / 1024).toFixed(2);
  console.log(`\nNon-Three.js total JS raw size: ${nonThreeKB} KB (Budget: <= 150 KB raw)`);
  if (nonThreeTotal > 150 * 1024) {
    errors.push(`Non-Three.js bundle size exceeded budget of 150 KB: ${nonThreeKB} KB`);
  }
}

console.log('\n========================================');
console.log(`TOTAL AUDITED: ${htmlFiles.length} pages`);
console.log(`ERRORS: ${errors.length}`);
console.log(`WARNINGS: ${warnings.length}`);
console.log('========================================\n');

if (errors.length > 0) {
  console.error('ERRORS:');
  for (const err of errors) {
    console.error(` ❌ ${err}`);
  }
  process.exit(1);
} else {
  console.log('✅ ALL VERIFICATIONS PASSED CLEANLY!');
}
