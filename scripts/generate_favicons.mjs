/**
 * Strova Group — Favicon and Brand Icon Generator
 *
 * Generates Google Search compliant favicons (96x96 PNG multiple of 48px),
 * legacy multi-resolution ICO, Apple Touch icon, and PWA manifest icons
 * from genuine brand vector source assets.
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT_DIR = process.cwd();
const BRAND_ICON_PNG = path.join(ROOT_DIR, 'public/images/brand/app-icon.png');
const SOURCE_SVG = path.join(ROOT_DIR, 'public/favicon.svg');
const SOURCE_LOGO_SVG = path.join(ROOT_DIR, 'public/images/logo.svg');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const PORTAL_PUBLIC_DIR = path.join(ROOT_DIR, 'portal/public');

async function generate() {
  if (!fs.existsSync(SOURCE_SVG)) {
    throw new Error(`Source favicon SVG not found at ${SOURCE_SVG}`);
  }

  // Favicons follow the approved site palette; the full-color logo remains a separate brand asset.
  const iconSource = SOURCE_SVG;
  const iconBuffer = fs.readFileSync(iconSource);
  const logoBuffer = fs.existsSync(BRAND_ICON_PNG) ? iconBuffer : (fs.existsSync(SOURCE_LOGO_SVG) ? fs.readFileSync(SOURCE_LOGO_SVG) : iconBuffer);

  // 1. Primary Favicon PNGs (multiples of 48: 96x96, 48x48)
  const png96 = await sharp(iconBuffer).resize(96, 96).png().toBuffer();
  const png48 = await sharp(iconBuffer).resize(48, 48).png().toBuffer();

  // 2. High-res touch and manifest icons
  const png180 = await sharp(iconBuffer).resize(180, 180).png().toBuffer();
  const png192 = await sharp(iconBuffer).resize(192, 192).png().toBuffer();
  const png512 = await sharp(iconBuffer).resize(512, 512).png().toBuffer();
  const logoPng512 = await sharp(logoBuffer).resize(512, 512).png().toBuffer();

  // Save to public/
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.png'), png96);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-96x96.png'), png96);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-48x48.png'), png48);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), png180);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-192x192.png'), png192);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-512x512.png'), png512);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'images/logo.png'), logoPng512);

  // 3. Multi-resolution ICO (16x16, 32x32, 48x48)
  const icoSizes = [16, 32, 48];
  const icoBuffers = await Promise.all(
    icoSizes.map((s) => sharp(iconBuffer).resize(s, s).png().toBuffer())
  );

  const count = icoSizes.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(count, 4); // count of images

  let offset = 6 + 16 * count;
  const entries = [];

  for (let i = 0; i < count; i++) {
    const s = icoSizes[i];
    const buf = icoBuffers[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(s >= 256 ? 0 : s, 0); // width
    entry.writeUInt8(s >= 256 ? 0 : s, 1); // height
    entry.writeUInt8(0, 2); // color palette (0 = 256 or more)
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buf.length, 8); // image size in bytes
    entry.writeUInt32LE(offset, 12); // offset in file
    entries.push(entry);
    offset += buf.length;
  }

  const icoData = Buffer.concat([header, ...entries, ...icoBuffers]);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoData);

  // 4. Sync to portal/public/
  if (fs.existsSync(PORTAL_PUBLIC_DIR)) {
    fs.writeFileSync(path.join(PORTAL_PUBLIC_DIR, 'favicon.png'), png96);
    fs.writeFileSync(path.join(PORTAL_PUBLIC_DIR, 'favicon-96x96.png'), png96);
    fs.writeFileSync(path.join(PORTAL_PUBLIC_DIR, 'favicon-48x48.png'), png48);
    fs.writeFileSync(path.join(PORTAL_PUBLIC_DIR, 'favicon.ico'), icoData);
    fs.writeFileSync(path.join(PORTAL_PUBLIC_DIR, 'apple-touch-icon.png'), png180);
  }

  console.log('✓ Successfully generated all favicons and icons:');
  console.log('  - favicon.png (96x96, Google Search recommended)');
  console.log('  - favicon-96x96.png (96x96)');
  console.log('  - favicon-48x48.png (48x48)');
  console.log('  - apple-touch-icon.png (180x180)');
  console.log('  - favicon-192x192.png (192x192)');
  console.log('  - favicon-512x512.png (512x512)');
  console.log('  - images/logo.png (512x512)');
  console.log('  - favicon.ico (multi-res 16, 32, 48)');
}

generate().catch((err) => {
  console.error('Failed to generate favicons:', err);
  process.exit(1);
});

