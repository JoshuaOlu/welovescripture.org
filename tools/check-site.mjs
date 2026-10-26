// Checks the built site (_site) for the things that make it findable and shareable.
import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, '_site'); const problems = []; const bad = (f, m) => problems.push(`${f}: ${m}`);
if (!fs.existsSync(OUT)) { console.error('No _site folder. Run "npm run build" first.'); process.exit(1); }
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(OUT); const rel = f => path.relative(OUT, f).split(path.sep).join('/');
const exists = u => { const clean = decodeURIComponent(u.split('#')[0].split('?')[0]); if (!clean.startsWith('/')) return true; const t = path.join(OUT, clean); return fs.existsSync(t) && (fs.statSync(t).isFile() || fs.existsSync(path.join(t, 'index.html'))); };
const pages = files.filter(f => f.endsWith('.html') && !rel(f).startsWith('pagefind/'));
const titles = new Map();
for (const f of pages) {
  const r = rel(f), h = fs.readFileSync(f, 'utf8'); if (/http-equiv="refresh"/.test(h)) continue;
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(h);
  const t = /<title>([^<]*)<\/title>/.exec(h)?.[1]; if (!t) bad(r, 'missing <title>');
  if (t) { if (titles.has(t) && !noindex) bad(r, `same title as ${titles.get(t)}`); titles.set(t, r); }
  if (!noindex) {
    if (!/<meta name="description" content="[^"]{20,}/.test(h)) bad(r, 'missing or very short meta description');
    if (!/<link rel="canonical" href="https:\/\//.test(h)) bad(r, 'missing canonical link');
    const og = /<meta property="og:image" content="([^"]+)"/.exec(h)?.[1]; if (!og) bad(r, 'missing og:image'); else { const u = new URL(og, 'https://x.test'); if (!exists(u.pathname)) bad(r, `og:image file not built (${u.pathname})`); }
    if (!/<meta name="twitter:card"/.test(h)) bad(r, 'missing twitter:card');
    if ((h.match(/<h1[\s>]/g) || []).length !== 1) bad(r, 'should have exactly one <h1>');
  }
  if (!/<html lang="/.test(h)) bad(r, 'missing html lang');
  for (const m of h.matchAll(/<img\b[^>]*>/g)) if (!/\balt=/.test(m[0])) bad(r, 'image without alt text');
  for (const m of h.matchAll(/\b(?:href|src)="(\/[^"#?]*)/g)) if (!exists(m[1]) && !(process.env.SKIP_SEARCH && m[1].startsWith('/pagefind/'))) bad(r, `broken link ${m[1]}`);
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { JSON.parse(m[1]); } catch { bad(r, 'invalid JSON-LD'); } }
}
for (const need of ['robots.txt', 'sitemap.xml', 'llms.txt', 'feed.xml', 'manifest.webmanifest', '.well-known/tdmrep.json', 'ai-policy/index.html', '404.html']) if (!fs.existsSync(path.join(OUT, need))) bad(need, 'missing from the build');
const robots = fs.existsSync(path.join(OUT, 'robots.txt')) ? fs.readFileSync(path.join(OUT, 'robots.txt'), 'utf8') : '';
if (!/Sitemap: https:\/\//.test(robots)) bad('robots.txt', 'no Sitemap line');
const groups = []; { let cur = null; for (const line of robots.split(/\r?\n/)) { const m = /^\s*(user-agent|disallow|allow)\s*:\s*(.*)$/i.exec(line); if (!m) continue; const k = m[1].toLowerCase(); if (k === 'user-agent') { if (!cur || cur.rules.length) groups.push(cur = { agents: [], rules: [] }); cur.agents.push(m[2].trim().toLowerCase()); } else cur?.rules.push([k, m[2].trim()]); } }
const blocked = a => groups.some(g => g.agents.includes(a.toLowerCase()) && g.rules.some(([k, v]) => k === 'disallow' && v === '/'));
for (const bot of ['GPTBot', 'CCBot', 'ClaudeBot']) if (!blocked(bot)) bad('robots.txt', `${bot} is not disallowed`);
for (const bot of ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'PerplexityBot']) if (blocked(bot)) bad('robots.txt', `${bot} is blocked, but should be welcome`);
if (blocked('*')) bad('robots.txt', 'blocks all crawlers');
const sm = fs.existsSync(path.join(OUT, 'sitemap.xml')) ? fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8') : '';
for (const m of sm.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)) if (!exists(m[1])) bad('sitemap.xml', `lists a page that was not built: ${m[1]}`);
if (process.env.CI && fs.existsSync(path.join(OUT, 'listen/index.html')) && !/\/listen\/[a-z0-9-]+\//.test(fs.readFileSync(path.join(OUT, 'listen/index.html'), 'utf8').replace(/href="\/listen\/"/g, ''))) bad('listen', 'no podcast episodes were found. Was the podcast feed reachable?');
console.log(`Checked ${pages.length} pages.`);
if (problems.length) { console.error('\nProblems found:\n - ' + problems.join('\n - ')); process.exit(1); }
console.log('Everything looks good.');
