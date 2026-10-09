// Regenerates /thumbs/*.webp + manifest.json (option-card previews) with headless Chromium.
//   npm i -D playwright   (or use a global install)   then:   node tools/gen-thumbs.mjs
// Run it whenever geometry changes, otherwise the cards show stale previews. `node tests/smoke.mjs` checks coverage.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8765;
let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  try { ({ chromium } = await import(path.join(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright', 'index.mjs'))); } catch { /* handled below */ }
}
if (!chromium) { console.error('playwright not found — install it (npm i -D playwright) or set PLAYWRIGHT_PATH'); process.exit(1); }

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.app && window.app.last, null, { timeout: 120000 });
  const shots = await page.evaluate(() => window.__renderThumbs());
  const dir = path.join(root, 'thumbs');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.webp')) fs.unlinkSync(path.join(dir, f));
  const manifest = {};
  for (const [key, url] of Object.entries(shots)) {
    const file = key.replace(':', '-') + '.webp';
    fs.writeFileSync(path.join(dir, file), Buffer.from(url.split(',')[1], 'base64'));
    manifest[key] = file;
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(`wrote ${Object.keys(manifest).length} thumbnails`);
} finally {
  await browser.close();
  server.kill();
}
