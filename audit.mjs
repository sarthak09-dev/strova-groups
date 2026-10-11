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

  // 2. Title tag
  const title = getTagContent(content, /<title>([\s\S]*?)<\/title>/i);
  if (!title) {
    errors.push(`[${relPath}] Missing <title> tag`);
  } else {
    const plainTitle = title.replace(/&amp;/g, '&').replace(/&#38;/g, '&');
    if (plainTitle.length > 60) {
      warnings.push(`[${relPath}] Title length is ${plainTitle.length} (> 60 chars): "${plainTitle}"`);
    }
  }

  // 3. Meta description
  const metaDescMatch = content.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  if (!metaDescMatch) {
    errors.push(`[${relPath}] Missing meta description`);
  } else {
    const desc = metaDescMatch[1].replace(/&amp;/g, '&').replace(/&#38;/g, '&');
    if (desc.length > 160) {
      warnings.push(`[${relPath}] Meta description length is ${desc.length} (> 160 chars): "${desc}"`);
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
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item['@context'] || !item['@type']) {
            errors.push(`[${relPath}] Invalid JSON-LD item structure: missing @context or @type`);
          }
        }
      } else {
        if (!parsed['@context'] || !parsed['@type']) {
          errors.push(`[${relPath}] Invalid JSON-LD structure: missing @context or @type`);
        }
      }
    } catch (e) {
      errors.push(`[${relPath}] Malformed JSON-LD: ${e.message}`);
    }
  }

  // 7. Check for old strings
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

  // 8. Skip link
  if (!content.includes('class="skip-link"')) {
    errors.push(`[${relPath}] Missing accessible skip link`);
  }

  // 9. Images have alt attributes
  const imgMatches = getAllMatches(content, /<img\b([^>]*)>/gi);
  for (const img of imgMatches) {
    if (!img[1].includes('alt="')) {
      errors.push(`[${relPath}] Image missing alt attribute: ${img[0]}`);
    }
  }

  // 10. Check internal anchor links
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
}

if (warnings.length > 0) {
  console.log('WARNINGS:');
  for (const warn of warnings) {
    console.log(` ⚠️  ${warn}`);
  }
}

// Check JS bundle sizes
const astroDir = path.join(distDir, '_astro');
if (fs.existsSync(astroDir)) {
  const jsFiles = fs.readdirSync(astroDir).filter(f => f.endsWith('.js'));
  console.log('\n--- JavaScript Bundles in dist/_astro/ ---');
  let nonThreeTotal = 0;
  for (const f of jsFiles) {
    const fullP = path.join(astroDir, f);
    const size = fs.statSync(fullP).size;
    console.log(`  ${f}: ${(size / 1024).toFixed(2)} KB raw`);
    if (!f.includes('three')) {
      nonThreeTotal += size;
    }
  }
  console.log(`\nNon-Three.js total JS raw size: ${(nonThreeTotal / 1024).toFixed(2)} KB (Gzip typically ~30-40% of raw)`);
}

if (errors.length > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL VERIFICATIONS PASSED CLEANLY!');
}
