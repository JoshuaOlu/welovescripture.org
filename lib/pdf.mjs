// Printable PDFs for guides. Built into _site/pdf/, never committed to the repo.
// Needs Playwright with Chromium (installed automatically by the GitHub Action). Turned on with PDF=1.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { esc } from './util.mjs';

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  try { return createRequire(import.meta.url)('playwright'); } catch {}
  try { const root = execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); return createRequire(path.join(root, 'x.js'))('playwright'); } catch {}
  return null;
}
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

export async function buildPdfs(jobs, outDir, { cacheDir = '.cache/pdf' } = {}) {
  if (!jobs.length) return { made: 0, cached: 0 };
  const pw = await loadPlaywright();
  if (!pw) { console.warn('[pdf] Playwright is not installed, so PDFs were skipped.'); return { made: 0, cached: 0, skipped: true }; }
  const { chromium } = pw.chromium ? pw : pw.default || pw;
  fs.mkdirSync(cacheDir, { recursive: true }); fs.mkdirSync(path.join(outDir, 'pdf'), { recursive: true });
  const styleKey = ['assets/css/site.css', 'assets/css/bundle.css', 'assets/css/tokens.css'].map(f => { try { return fs.readFileSync(path.join(outDir, f)); } catch { return ''; } }).join('');
  const ROOT_OUT = path.resolve(outDir);
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(ROOT_OUT, rel);
    if (!f.startsWith(ROOT_OUT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
  let made = 0, cached = 0, browser;
  try {
    for (const j of jobs) {
      const htmlFile = path.join(outDir, j.url, 'index.html'); if (!fs.existsSync(htmlFile)) continue;
      const key = crypto.createHash('sha1').update(fs.readFileSync(htmlFile)).update(styleKey).update('v2').digest('hex').slice(0, 20);
      const hit = path.join(cacheDir, key + '.pdf'); const dest = path.join(outDir, 'pdf', j.slug + '.pdf');
      if (fs.existsSync(hit)) { fs.copyFileSync(hit, dest); cached++; continue; }
      browser ??= await chromium.launch();
      const page = await browser.newPage({ colorScheme: 'light' });
      await page.goto(`http://127.0.0.1:${port}${j.url}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await page.emulateMedia({ media: 'print', colorScheme: 'light' });
      await page.addStyleTag({ content: '.print-foot{display:none!important}' });
      const foot = `<div style="font:8px Helvetica,Arial,sans-serif;color:#666;width:100%;padding:0 16mm;display:flex;justify-content:space-between"><span>${esc(j.title)}</span><span>${esc(j.host)} &nbsp;·&nbsp; <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
      const buf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<div></div>', footerTemplate: foot });
      fs.writeFileSync(hit, buf); fs.copyFileSync(hit, dest); made++; await page.close();
    }
  } finally { await browser?.close(); server.close(); }
  return { made, cached };
}
