import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const inputPath = 'C:/Users/kumar/.gemini/antigravity/brain/11e74a1a-e000-4a33-b465-bd54f3137449/.user_uploaded/media_1793104868810_7e61c39a.jpg';
const brandDir = path.resolve('public/images/brand');

if (!fs.existsSync(brandDir)) {
  fs.mkdirSync(brandDir, { recursive: true });
}

async function process() {
  console.log('Processing official Strova Group brand assets...');

  // 1. App Icon Squircle (High quality, Row 2 Col 3)
  // [620, 390, 122, 122]
  await sharp(inputPath)
    .extract({ left: 618, top: 388, width: 124, height: 124 })
    .resize(512, 512, { kernel: sharp.kernel.lanczos3 })
    .png({ quality: 100 })
    .toFile(path.join(brandDir, 'app-icon.png'));

  // 2. 3D Ribbon S Monogram (Top Section)
  // Left: 155, Top: 70, Width: 235, Height: 265
  await sharp(inputPath)
    .extract({ left: 155, top: 70, width: 235, height: 265 })
    .resize(470, 530, { kernel: sharp.kernel.lanczos3 })
    .png({ quality: 100 })
    .toFile(path.join(brandDir, 'ribbon-s-3d.png'));

  // 3. Top Full Lockup (Ribbon S + Wordmark + Tagline)
  // Left: 150, Top: 60, Width: 730, Height: 275
  await sharp(inputPath)
    .extract({ left: 150, top: 60, width: 730, height: 275 })
    .resize(1460, 550, { kernel: sharp.kernel.lanczos3 })
    .png({ quality: 100 })
    .toFile(path.join(brandDir, 'brand-hero-lockup.png'));

  // 4. Full Logo Dark (Row 2 Col 2)
  // Ribbon S + STROVA GROUP on dark
  await sharp(inputPath)
    .extract({ left: 340, top: 400, width: 220, height: 95 })
    .resize(660, 285, { kernel: sharp.kernel.lanczos3 })
    .png({ quality: 100 })
    .toFile(path.join(brandDir, 'logo-dark.png'));

  // 5. Full Logo Light (Row 2 Col 1)
  await sharp(inputPath)
    .extract({ left: 45, top: 400, width: 245, height: 95 })
    .resize(735, 285, { kernel: sharp.kernel.lanczos3 })
    .png({ quality: 100 })
    .toFile(path.join(brandDir, 'logo-light.png'));

  // 6. Isolated 3D Icon Mark (Row 3 Col 2)
  await sharp(inputPath)
    .extract({ left: 375, top: 560, width: 105, height: 110 })
    .resize(420, 440, { kernel: sharp.kernel.lanczos3 })
    .png({ quality: 100 })
    .toFile(path.join(brandDir, 'icon-mark.png'));

  // 7. Hero Banner Purple Waves (Row 4 Right: luminous purple fluid silk ribbon)
  await sharp(inputPath)
    .extract({ left: 810, top: 705, width: 214, height: 255 })
    .resize(856, 1020, { kernel: sharp.kernel.lanczos3 })
    .png({ quality: 100 })
    .toFile(path.join(brandDir, 'hero-purple-waves.png'));

  // 8. Mobile App Mockup Preview (Row 4 Center)
  await sharp(inputPath)
    .extract({ left: 350, top: 690, width: 280, height: 270 })
    .resize(560, 540, { kernel: sharp.kernel.lanczos3 })
    .png({ quality: 100 })
    .toFile(path.join(brandDir, 'mobile-mockup.png'));

  // 9. Card Mockup Preview (Row 4 Left)
  await sharp(inputPath)
    .extract({ left: 0, top: 690, width: 345, height: 270 })
    .resize(690, 540, { kernel: sharp.kernel.lanczos3 })
    .png({ quality: 100 })
    .toFile(path.join(brandDir, 'card-mockup.png'));

  // Also create WebP variants for ultra-fast loading
  for (const name of ['ribbon-s-3d', 'brand-hero-lockup', 'logo-dark', 'logo-light', 'app-icon', 'hero-purple-waves', 'mobile-mockup', 'card-mockup']) {
    const pngPath = path.join(brandDir, `${name}.png`);
    const webpPath = path.join(brandDir, `${name}.webp`);
    await sharp(pngPath).webp({ quality: 92 }).toFile(webpPath);
  }

  console.log('Brand assets generated in public/images/brand/');
}

process().catch(console.error);

