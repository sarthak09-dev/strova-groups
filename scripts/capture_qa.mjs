import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PORTAL_DIST_DIR = path.join(ROOT_DIR, 'portal/dist');
const OUTPUT_DIR = '/home/sarthak/.gemini/antigravity/brain/6f502c6e-655e-457e-bc16-9a21730ecd78/qa_evidence';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const server = http.createServer((req, res) => {
  let urlPath = new URL(req.url, 'http://127.0.0.1:4321').pathname;
  let baseDir = DIST_DIR;

  if (urlPath.startsWith('/portal/')) {
    baseDir = PORTAL_DIST_DIR;
    urlPath = urlPath.replace(/^\/portal/, '');
  }

  let filePath = path.join(baseDir, urlPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(4321, '127.0.0.1', async () => {
  console.log('Static preview server active on http://127.0.0.1:4321');

  const targets = [
    { name: 'homepage_en_desktop_1440', url: 'http://127.0.0.1:4321/', w: 1440, h: 900 },
    { name: 'homepage_en_tablet_1024', url: 'http://127.0.0.1:4321/', w: 1024, h: 768 },
    { name: 'homepage_en_tablet_768', url: 'http://127.0.0.1:4321/', w: 768, h: 1024 },
    { name: 'homepage_en_mobile_375', url: 'http://127.0.0.1:4321/', w: 375, h: 812 },
    { name: 'homepage_en_mobile_320', url: 'http://127.0.0.1:4321/', w: 320, h: 568 },
    { name: 'homepage_hi_desktop_1440', url: 'http://127.0.0.1:4321/hi/', w: 1440, h: 900 },
    { name: 'homepage_hi_mobile_375', url: 'http://127.0.0.1:4321/hi/', w: 375, h: 812 },
    { name: 'contact_en_desktop_1440', url: 'http://127.0.0.1:4321/contact/', w: 1440, h: 900 },
    { name: 'contact_en_mobile_375', url: 'http://127.0.0.1:4321/contact/', w: 375, h: 812 },
    { name: 'contact_hi_desktop_1440', url: 'http://127.0.0.1:4321/hi/contact/', w: 1440, h: 900 },
    { name: 'contact_hi_mobile_375', url: 'http://127.0.0.1:4321/hi/contact/', w: 375, h: 812 },
    { name: 'portal_login_desktop_1440', url: 'http://127.0.0.1:4321/portal/login/', w: 1440, h: 900 },
    { name: 'portal_login_mobile_375', url: 'http://127.0.0.1:4321/portal/login/', w: 375, h: 812 },
    { name: 'portal_hub_desktop_1440', url: 'http://127.0.0.1:4321/portal/', w: 1440, h: 900 },
  ];

  for (const t of targets) {
    const outPath = path.join(OUTPUT_DIR, `${t.name}.png`);
    try {
      const cmd = `/opt/google/chrome/chrome --headless=new --disable-gpu --no-sandbox --window-size=${t.w},${t.h} --virtual-time-budget=2000 --screenshot="${outPath}" "${t.url}"`;
      await execAsync(cmd, { timeout: 15000 });
      console.log(`  ✓ ${t.name} (${t.w}x${t.h}) -> ${fs.statSync(outPath).size} bytes`);
    } catch (err) {
      console.error(`  ✗ Error capturing ${t.name}:`, err.message);
    }
  }

  server.close(() => {
    console.log('Server stopped. Multi-viewport QA capture complete.');
    process.exit(0);
  });
});
