// The We Love Scripture console: a local-only web app for managing the site. Run with: node console/server.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import AdmZip from 'adm-zip';
import { ROOT, p, readJson, writeJson, slugify, stripMarkdown, TYPES } from '../lib/util.mjs';
import * as content from '../lib/content.mjs';
import { createMarkdown } from '../lib/markdown.mjs';
import { syncEpisodes } from '../lib/episodes.mjs';
import { renderOgCached } from '../lib/og.mjs';
import { ytId } from '../lib/seo.mjs';

const md = createMarkdown();
const DATA = { site: 'src/_data/site.json', nav: 'src/_data/nav.json', counters: 'src/_data/counters.json', episodeMap: 'src/_data/episodeMap.json' };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const PREVIEW_PORT = 8090;
let PORT = 4321;
let preview = { proc: null, logs: [], url: `http://localhost:${PREVIEW_PORT}/` };

const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(type === 'application/json' ? JSON.stringify(body) : body); };
const fail = (res, code, msg) => send(res, code, { error: msg });
const body = req => new Promise((ok, no) => { let n = 0; const c = []; req.on('data', d => { n += d.length; if (n > 14e6) { no(new Error('Too large')); req.destroy(); } else c.push(d); }); req.on('end', () => { try { ok(c.length ? JSON.parse(Buffer.concat(c).toString('utf8')) : {}); } catch (e) { no(e); } }); });
const run = (cmd, args, opts = {}) => new Promise(ok => execFile(cmd, args, { cwd: ROOT, timeout: 120000, windowsHide: true, maxBuffer: 8e6, ...opts }, (err, stdout, stderr) => ok({ ok: !err, code: err?.code ?? 0, out: (stdout || '') + (stderr || '') })));
const today = () => new Date().toISOString().slice(0, 10);

// ---------- helpers
function counts() {
  const res = content.list('resources'); const pub = res.filter(r => !r.data.draft);
  const by = t => pub.filter(r => r.data.type === t).length;
  const eps = readJson(p('src/_data/episodes.cache.json'), { episodes: [] }); const map = readJson(p(DATA.episodeMap), {});
  return { resources: pub.length, drafts: res.length - pub.length, gather: by('gather'), read: by('read'), watch: by('watch'), kids: by('kids'), projects: content.list('projects').filter(x => !x.data.draft).length, episodes: (eps.episodes || []).filter(e => !map[e.guid]?.hidden).length, pages: content.list('pages').length };
}
function counterValues() {
  const c = counts(), cfg = readJson(p(DATA.counters), { items: [] });
  const auto = { episodes: c.episodes, guides: c.gather, articles: c.read, videos: c.watch, projects: c.projects, resources: c.resources };
  const out = {}; for (const it of cfg.items) out[it.id] = it.source?.startsWith('auto:') ? (auto[it.source.slice(5)] ?? 0) : (it.value || 0);
  return out;
}
function snapshot() {
  const log = readJson(p('src/_data/growthLog.json'), []); const date = today();
  const entry = { date, values: counterValues() }; const i = log.findIndex(x => x.date === date);
  if (i >= 0) log[i] = entry; else log.push(entry);
  writeJson(p('src/_data/growthLog.json'), log.slice(-400)); return log;
}
async function gitState() {
  if (!fs.existsSync(p('.git'))) return { isRepo: false, remote: '', branch: '', changes: [] };
  const [st, rm, br] = await Promise.all([run('git', ['status', '--porcelain']), run('git', ['remote', 'get-url', 'origin']), run('git', ['rev-parse', '--abbrev-ref', 'HEAD'])]);
  const changes = st.out.split('\n').filter(Boolean).map(l => ({ flag: l.slice(0, 2).trim() || '?', file: l.slice(3) }));
  return { isRepo: true, remote: rm.ok ? rm.out.trim() : '', branch: br.ok ? br.out.trim() : '', changes };
}
function checks() {
  const out = []; const site = readJson(p(DATA.site), {}); const add = (sev, where, id, kind, msg) => out.push({ sev, where, id, kind, msg });
  const projects = content.projectsIndex();
  for (const { id, data, body: b } of content.list('resources')) {
    const w = data.title || id; const dr = data.draft ? ' (draft)' : '';
    if (!data.title || data.title.length < 8) add('warn', w + dr, id, 'resources', 'Title is very short.');
    if (data.title && data.title.length > 65) add('warn', w + dr, id, 'resources', `Title is ${data.title.length} characters; search engines show about 60.`);
    if (!data.summary) add('bad', w + dr, id, 'resources', 'No summary. It is used for search results and social previews.');
    else if (data.summary.length < 60 || data.summary.length > 170) add('warn', w + dr, id, 'resources', `Summary is ${data.summary.length} characters; 70 to 160 works best.`);
    if (!data.project) add('info', w + dr, id, 'resources', 'Not part of a project. That is fine, but projects help people keep going.');
    else if (!projects[data.project]) add('bad', w + dr, id, 'resources', `Project "${data.project}" does not exist.`);
    else if (!data.draft && projects[data.project].draft) add('bad', w + dr, id, 'resources', `This is published, but its project "${projects[data.project].title}" is still a draft, so the link to it would be broken. Publish the project too.`);
    if (data.type === 'watch' && !ytId(data.youtube)) add('bad', w + dr, id, 'resources', 'Video has no valid YouTube link.');
    if (/!\[\]\(/.test(b || '')) add('warn', w + dr, id, 'resources', 'An image has no description (alt text). Screen readers and search engines need it.');
    if (data.type === 'gather' && !/^:::\s*talk/m.test(b || '')) add('warn', w + dr, id, 'resources', 'This guide has no "Tell each other" prompt, which is the heart of a guide.');
    if (/^:::\s*passage\s+[^|\n]+$/m.test(b || '')) add('warn', w + dr, id, 'resources', 'A Scripture passage does not name its translation.');
    if (data.type !== 'watch' && (b || '').trim().split(/\s+/).length < 80) add('info', w + dr, id, 'resources', 'Very short. Pages with little text are harder to find.');
  }
  for (const { id, data } of content.list('projects')) { if (!data.summary) add('bad', data.title || id, id, 'projects', 'No summary.'); if (!content.list('resources').some(r => r.data.project === id && !r.data.draft)) add('info', data.title || id, id, 'projects', 'No published resources yet. The project page will look empty.'); }
  if (!site.verification?.google) add('info', 'Settings', '', 'settings', 'Google Search Console is not connected yet. Adding the site there speeds up discovery.');
  if (!/^https:\/\//.test(site.url || '')) add('bad', 'Settings', '', 'settings', 'The site address must start with https://');
  if (!fs.existsSync(p('CNAME'))) add('info', 'Domain', '', 'settings', 'No CNAME file. Add your domain in Settings if you use a custom domain.');
  return out;
}
async function lookupPassage(ref, tr) {
  const t = { kjv: 'kjv', web: 'web', bbe: 'bbe' }[tr] || 'kjv';
  const r = await fetch(`https://bible-api.com/${encodeURIComponent(ref)}?translation=${t}`, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'WeLoveScriptureConsole/1.0' } });
  if (!r.ok) throw new Error('Passage not found. Check the reference, for example "John 3:16-17".');
  const j = await r.json(); if (!j.verses?.length) throw new Error('Passage not found.');
  return { reference: j.reference, translation: j.translation_name, verses: j.verses.map(v => ({ n: v.verse, text: v.text.replace(/\s+/g, ' ').trim() })) };
}
async function oembed(url) {
  const id = ytId(url); if (!id) throw new Error('That does not look like a YouTube link.');
  const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}&format=json`, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('YouTube did not return details for that video. Is it public?');
  const j = await r.json(); return { id, title: j.title, author: j.author_name, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
}
function startPreview() {
  if (preview.proc) return;
  const bin = p('node_modules/@11ty/eleventy/cmd.cjs'); if (!fs.existsSync(bin)) throw new Error('Eleventy is not installed. Close the console and start it again.');
  preview.logs = [];
  preview.proc = spawn(process.execPath, [bin, '--serve', `--port=${PREVIEW_PORT}`], { cwd: ROOT, env: { ...process.env, DRAFTS: '1' }, windowsHide: true });
  const add = d => { preview.logs.push(...d.toString().split('\n').filter(Boolean)); preview.logs = preview.logs.slice(-200); };
  preview.proc.stdout.on('data', add); preview.proc.stderr.on('data', add);
  preview.proc.on('exit', () => { preview.proc = null; });
}
const stopPreview = () => { if (preview.proc) { preview.proc.kill(); preview.proc = null; } };


// ---------- updates: apply a zip from Claude without touching your own content
let pendingUpdate = null;
const readVersion = () => { try { return fs.readFileSync(p('VERSION'), 'utf8').trim(); } catch { return '1.0.0'; } };
const isPlain = v => v && typeof v === 'object' && !Array.isArray(v);
function addMissing(t, s) {
  for (const k of Object.keys(s)) {
    if (!(k in t)) t[k] = s[k];
    else if (isPlain(t[k]) && isPlain(s[k])) addMissing(t[k], s[k]);
    else if (Array.isArray(t[k]) && Array.isArray(s[k]) && s[k].every(x => isPlain(x) && x.id !== undefined) && t[k].every(x => isPlain(x) && x.id !== undefined)) for (const x of s[k]) if (!t[k].some(y => y.id === x.id)) t[k].push(x);
  }
  return t;
}
// what to do with each incoming file: 'write' | 'skip' | 'merge' | 'addonly'
function ruleFor(rel) {
  const exists = fs.existsSync(p(rel));
  if (/^(node_modules|_site|\.cache|trash|\.git|\.backups)\//.test(rel) || rel === 'CNAME' || /^src\/assets\/uploads\//.test(rel)) return exists || rel === 'CNAME' ? 'skip' : 'write';
  if (rel.startsWith('src/_data/') && rel.endsWith('.json')) return exists ? (/\/(site|counters)\.json$/.test(rel) ? 'merge' : 'skip') : 'write';
  if (rel.startsWith('src/content/') && !rel.endsWith('.11tydata.js')) return exists ? 'skip' : 'write';
  return 'write';
}
function inspectZip(buf) {
  let zip; try { zip = new AdmZip(buf); } catch { throw new Error('That does not look like a zip file.'); }
  let entries = zip.getEntries().filter(e => !e.isDirectory && !/(^|\/)(__MACOSX|\.DS_Store)/.test(e.entryName));
  const names = entries.map(e => e.entryName.replace(/\\/g, '/'));
  if (names.some(n => n.startsWith('/') || n.split('/').includes('..') || /^[A-Za-z]:/.test(n))) throw new Error('This zip has unsafe file paths, so it was not opened.');
  let root = ''; if (!names.includes('package.json')) { const tops = new Set(names.map(n => n.split('/')[0])); if (tops.size === 1 && names.includes([...tops][0] + '/package.json')) root = [...tops][0] + '/'; }
  const files = entries.map((e, i) => ({ rel: names[i].slice(root.length), entry: e })).filter(f => f.rel);
  const manifestEntry = files.find(f => f.rel === 'update.json'); const allFiles = files; files.splice(0, files.length, ...files.filter(f => f.rel !== 'update.json'));
  // An update is either a full site zip (has package.json) or a small update zip (has update.json listing what to remove).
  const pj = files.find(f => f.rel === 'package.json'), mf = manifestEntry;
  if (!pj && !mf) throw new Error('This is not a We Love Scripture update.');
  let man = {}; try { man = JSON.parse((mf || pj).entry.getData().toString('utf8')); } catch {}
  if (man.name !== 'welovescripture-site') throw new Error('This zip is for a different project.');
  const vf = files.find(f => f.rel === 'VERSION'); const incoming = (vf ? vf.entry.getData().toString('utf8').trim() : man.version) || 'unknown';
  const verNum = v => String(v).split('.').map(n => parseInt(n, 10) || 0); const older = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0); return false; };
  if (mf && man.requires && older(readVersion(), man.requires)) throw new Error(`This update builds on version ${man.requires}, and you have ${readVersion()}. Apply the earlier update first, or ask for the full zip.`);
  const removeList = (mf && Array.isArray(man.remove) ? man.remove : []).filter(r => typeof r === 'string' && !r.includes('..') && !r.startsWith('/') && ruleFor(r) === 'write' && fs.existsSync(p(r)) && !/^src\/(content|_data)\/[^/]+\.(md|json)$/.test(r) && !/^src\/assets\/uploads\//.test(r));
  const plan = { add: [], change: [], keep: [], merge: [], remove: removeList, same: 0 };
  for (const f of files) {
    const rule = ruleFor(f.rel); const data = f.entry.getData(); const cur = p(f.rel); const has = fs.existsSync(cur);
    if (rule === 'skip') { plan.keep.push(f.rel); continue; }
    if (rule === 'merge') { try { const t = JSON.parse(fs.readFileSync(cur, 'utf8')), n = JSON.parse(JSON.stringify(t)); addMissing(n, JSON.parse(data.toString('utf8'))); if (JSON.stringify(n) !== JSON.stringify(t)) plan.merge.push(f.rel); else plan.keep.push(f.rel); f.merged = JSON.stringify(n, null, 2) + '\n'; } catch { plan.keep.push(f.rel); } continue; }
    if (!has) { plan.add.push(f.rel); f.write = data; continue; }
    if (Buffer.compare(fs.readFileSync(cur), data) === 0) { plan.same++; continue; }
    plan.change.push(f.rel); f.write = data;
  }
  const restart = [...plan.add, ...plan.change, ...plan.remove].some(r => /^(console|lib)\//.test(r) || r === 'package.json' || r === 'eleventy.config.js');
  return { files, plan, current: readVersion(), incoming, restart, installNeeded: [...plan.add, ...plan.change].includes('package.json') };
}
function applyUpdate(u) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-'); const bk = p('.backups', 'update-' + stamp); let n = 0;
  for (const f of u.files) {
    const out = f.merged && u.plan.merge.includes(f.rel) ? Buffer.from(f.merged) : f.write; if (!out) continue;
    const dest = p(f.rel); if (fs.existsSync(dest)) { fs.mkdirSync(path.dirname(path.join(bk, f.rel)), { recursive: true }); fs.copyFileSync(dest, path.join(bk, f.rel)); }
    fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, out); n++;
  }
  for (const r of u.plan.remove) { const dest = p(r); if (fs.existsSync(dest)) { fs.mkdirSync(path.dirname(path.join(bk, r)), { recursive: true }); fs.copyFileSync(dest, path.join(bk, r)); fs.rmSync(dest); n++; } }
  return { applied: n, backup: fs.existsSync(bk) ? path.relative(ROOT, bk) : '' };
}

// ---------- API
async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1); const [a, b, c] = parts; const m = req.method;
  const readBody = () => body(req);
  if (a === 'overview' && m === 'GET') return send(res, 200, { site: readJson(p(DATA.site)), counts: counts(), git: await gitState(), preview: { running: !!preview.proc, url: preview.url }, episodes: { fetchedAt: readJson(p('src/_data/episodes.cache.json'), {}).fetchedAt || null }, checks: checks().filter(x => x.sev !== 'info').length, node: process.version, version: readVersion() });
  if (a === 'items') {
    const kind = b; if (!content.KINDS[kind]) return fail(res, 404, 'Unknown kind');
    if (m === 'GET' && !c) return send(res, 200, content.list(kind).map(x => ({ id: x.id, data: x.data, words: (x.body.match(/\S+/g) || []).length, mtime: x.mtime })));
    if (m === 'GET') { const it = content.read(kind, c); return it ? send(res, 200, it) : fail(res, 404, 'Not found'); }
    if (m === 'POST') { const j = await readBody(); const id = content.uniqueId(kind, j.data?.title || 'untitled'); content.write(kind, id, j.data || {}, j.body || ''); return send(res, 200, { id }); }
    if (m === 'PUT') { const j = await readBody(); content.write(kind, c, j.data || {}, j.body || ''); return send(res, 200, { id: c }); }
    if (m === 'DELETE') return send(res, 200, { removed: content.remove(kind, c) });
  }
  if (a === 'data') {
    if (!DATA[b]) return fail(res, 404, 'Unknown data');
    if (m === 'GET') return send(res, 200, readJson(p(DATA[b])));
    if (m === 'PUT') { const j = await readBody(); writeJson(p(DATA[b]), j); if (b === 'site' && j.url) { const host = new URL(j.url).host; fs.writeFileSync(p('CNAME'), host + '\n'); } return send(res, 200, { ok: true }); }
  }
  if (a === 'episodes') {
    if (m === 'GET') { const site = readJson(p(DATA.site)); const d = await syncEpisodes(site.podcastRss, {}); return send(res, 200, { ...d, map: readJson(p(DATA.episodeMap), {}) }); }
    if (m === 'POST') { const site = readJson(p(DATA.site)); const d = await syncEpisodes(site.podcastRss, { force: true }); return send(res, 200, { ...d, map: readJson(p(DATA.episodeMap), {}) }); }
  }
  if (a === 'media') {
    const dir = p('src/assets/uploads'); fs.mkdirSync(dir, { recursive: true });
    if (m === 'GET') return send(res, 200, fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp|gif|svg)$/i.test(f)).map(f => ({ name: f, url: '/assets/uploads/' + f, size: fs.statSync(path.join(dir, f)).size, mtime: fs.statSync(path.join(dir, f)).mtimeMs })).sort((x, y) => y.mtime - x.mtime));
    if (m === 'POST') {
      const j = await readBody(); const mm = /^data:image\/(png|jpeg|webp|gif);base64,(.+)$/.exec(j.dataUrl || ''); if (!mm) return fail(res, 400, 'Please choose a PNG, JPG, WebP or GIF image.');
      const ext = mm[1] === 'jpeg' ? 'jpg' : mm[1]; const base = slugify(String(j.name || 'image').replace(/\.[a-z0-9]+$/i, '')) || 'image'; let name = `${base}.${ext}`, i = 2;
      while (fs.existsSync(path.join(dir, name))) name = `${base}-${i++}.${ext}`;
      fs.writeFileSync(path.join(dir, name), Buffer.from(mm[2], 'base64')); return send(res, 200, { name, url: '/assets/uploads/' + name });
    }
    if (m === 'DELETE' && /^[a-z0-9-]+\.(jpg|png|webp|gif)$/.test(b || '')) { const f = path.join(dir, b); if (fs.existsSync(f)) { fs.mkdirSync(p('trash/media'), { recursive: true }); fs.renameSync(f, p('trash/media', Date.now() + '-' + b)); } return send(res, 200, { ok: true }); }
  }
  if (a === 'passage' && m === 'GET') { try { return send(res, 200, await lookupPassage(url.searchParams.get('ref') || '', url.searchParams.get('tr') || 'kjv')); } catch (e) { return fail(res, 502, e.message); } }
  if (a === 'youtube' && m === 'GET') { try { return send(res, 200, await oembed(url.searchParams.get('url') || '')); } catch (e) { return fail(res, 502, e.message); } }
  if (a === 'render' && m === 'POST') { const j = await readBody(); return send(res, 200, { html: md.render(String(j.body || '')) }); }
  if (a === 'og' && m === 'GET') { const q = url.searchParams; const site = readJson(p(DATA.site), {}); const png = await renderOgCached({ title: q.get('title') || 'Your title here', kicker: q.get('kicker') || '', seed: q.get('seed') || q.get('title') || '', domain: new URL(site.url || 'https://welovescripture.org').host, siteName: site.name || 'We Love Scripture' }); res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' }); return res.end(png); }
  if (a === 'update') {
    if (b === 'inspect' && m === 'POST') {
      const j = await readBody(); const mm = /^data:[^;,]*;base64,(.+)$/.exec(j.dataUrl || ''); if (!mm) return fail(res, 400, 'Please choose a zip file.');
      pendingUpdate = inspectZip(Buffer.from(mm[1], 'base64')); const u = pendingUpdate;
      return send(res, 200, { current: u.current, incoming: u.incoming, add: u.plan.add, change: u.plan.change, merge: u.plan.merge, remove: u.plan.remove, keepCount: u.plan.keep.length, same: u.plan.same, restart: u.restart });
    }
    if (b === 'apply' && m === 'POST') {
      if (!pendingUpdate) return fail(res, 400, 'Choose the zip again first.');
      const u = pendingUpdate; pendingUpdate = null; const r = applyUpdate(u);
      send(res, 200, { ...r, restart: u.restart, version: u.incoming });
      if (u.restart) setTimeout(() => { stopPreview(); process.exit(75); }, 600);
      return;
    }
  }
  if (a === 'check' && m === 'GET') return send(res, 200, checks());
  if (a === 'growth') { if (m === 'POST') return send(res, 200, snapshot()); return send(res, 200, { log: readJson(p('src/_data/growthLog.json'), []), now: counterValues(), config: readJson(p(DATA.counters)) }); }
  if (a === 'preview') {
    if (b === 'start' && m === 'POST') { try { startPreview(); } catch (e) { return fail(res, 500, e.message); } return send(res, 200, { running: true, url: preview.url }); }
    if (b === 'stop' && m === 'POST') { stopPreview(); return send(res, 200, { running: false }); }
    return send(res, 200, { running: !!preview.proc, url: preview.url, logs: preview.logs.slice(-40) });
  }
  if (a === 'build' && m === 'POST') { const r = await run(process.execPath, [p('node_modules/@11ty/eleventy/cmd.cjs')], { timeout: 300000 }); return send(res, 200, { ok: r.ok, log: r.out.split('\n').slice(-30).join('\n') }); }
  if (a === 'git') {
    if (m === 'GET') return send(res, 200, await gitState());
    if (b === 'init' && m === 'POST') { const r = await run('git', ['init', '-b', 'main']); return send(res, 200, { ok: r.ok, log: r.out }); }
    if (b === 'remote' && m === 'POST') { const j = await readBody(); if (!/^(https:\/\/github\.com\/|git@github\.com:)[\w.-]+\/[\w.-]+(\.git)?$/.test(j.url || '')) return fail(res, 400, 'Paste the repository address from GitHub, like https://github.com/yourname/welovescripture-site.git'); await run('git', ['remote', 'remove', 'origin']); const r = await run('git', ['remote', 'add', 'origin', j.url]); return send(res, 200, { ok: r.ok, log: r.out }); }
    if (b === 'publish' && m === 'POST') {
      const j = await readBody(); const msg = String(j.message || 'Update the site').replace(/["\r\n]/g, ' ').slice(0, 200); const log = [];
      try { snapshot(); } catch {}
      let r = await run('git', ['add', '-A']); log.push(r.out); if (!r.ok) return send(res, 200, { ok: false, log: log.join('\n'), hint: 'Git could not stage the changes.' });
      const st = await run('git', ['status', '--porcelain']);
      if (st.out.trim()) { r = await run('git', ['commit', '-m', msg]); log.push(r.out); if (!r.ok) return send(res, 200, { ok: false, log: log.join('\n'), hint: /user\.(name|email)|identity/i.test(r.out) ? 'Git needs to know who you are once. In a terminal run: git config --global user.name "Your Name" and git config --global user.email "you@example.com"' : 'The commit failed.' }); }
      r = await run('git', ['push', '-u', 'origin', 'HEAD'], { timeout: 180000 }); log.push(r.out);
      return send(res, 200, { ok: r.ok, log: log.join('\n'), hint: r.ok ? '' : 'Pushing failed. Check you are signed in to GitHub on this computer and that the repository address is right.' });
    }
  }
  return fail(res, 404, 'Not found');
}

// ---------- static files
function serveFile(res, file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' }); fs.createReadStream(file).pipe(res); return true;
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const host = (req.headers.host || '').split(':')[0]; if (host !== 'localhost' && host !== '127.0.0.1') return fail(res, 403, 'Local only');
    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.headers['x-wls-console'] !== '1') return fail(res, 403, 'Missing header');
      const o = req.headers.origin; if (o && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(o)) return fail(res, 403, 'Bad origin');
      return await api(req, res, url);
    }
    let rel = decodeURIComponent(url.pathname); if (rel.includes('..')) return fail(res, 400, 'Bad path');
    if (rel.startsWith('/assets/')) { if (serveFile(res, path.join(p('src'), rel))) return; }
    if (rel === '/') rel = '/index.html';
    if (serveFile(res, path.join(p('console/public'), rel))) return;
    send(res, 404, 'Not found', 'text/plain');
  } catch (e) { console.error(e.expected ? e.message : e); if (!res.headersSent) fail(res, 500, e.message || 'Something went wrong'); else res.end(); }
});

function listen(port) {
  server.once('error', e => { if (e.code === 'EADDRINUSE' && port < 4340) listen(port + 1); else { console.error(e.message); process.exit(1); } });
  server.listen(port, '127.0.0.1', () => {
    PORT = port; const addr = `http://localhost:${port}/`;
    console.log(`\n  We Love Scripture console is running at ${addr}\n  Leave this window open while you work. Close it to stop.\n`);
    if (!process.env.NO_OPEN) { const [cmd, args] = process.platform === 'darwin' ? ['open', [addr]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', addr]] : ['xdg-open', [addr]]; try { spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch {} }
  });
}
listen(PORT);
process.on('SIGINT', () => { stopPreview(); process.exit(0); });
process.on('exit', stopPreview);
