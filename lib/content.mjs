// Reading and writing the Markdown content files. Used by the build and by the console.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { p, slugify } from './util.mjs';

export const KINDS = { projects: 'src/content/projects', resources: 'src/content/resources', pages: 'src/content/pages' };
export const validId = id => /^[a-z0-9][a-z0-9-]{0,80}$/.test(id);

function dirOf(kind) { if (!KINDS[kind]) throw new Error('Unknown content kind'); return p(KINDS[kind]); }

export function list(kind) {
  const dir = dirOf(kind); fs.mkdirSync(dir, { recursive: true });
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const id = f.replace(/\.md$/, ''); const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    const { data, content } = matter(raw);
    return { id, data: normalise(data), body: content, mtime: fs.statSync(path.join(dir, f)).mtimeMs };
  });
}
export function read(kind, id) {
  if (!validId(id)) throw new Error('Bad id');
  const file = path.join(dirOf(kind), id + '.md'); if (!fs.existsSync(file)) return null;
  const { data, content } = matter(fs.readFileSync(file, 'utf8'));
  return { id, data: normalise(data), body: content };
}
export function write(kind, id, data, body) {
  if (!validId(id)) throw new Error('Bad id');
  const dir = dirOf(kind); fs.mkdirSync(dir, { recursive: true });
  const clean = {}; for (const [k, v] of Object.entries(data)) { if (v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && !v.length)) clean[k] = v; }
  fs.writeFileSync(path.join(dir, id + '.md'), matter.stringify(String(body || '').replace(/\s+$/, '') + '\n', clean));
  return id;
}
export function remove(kind, id) {
  if (!validId(id)) throw new Error('Bad id');
  const file = path.join(dirOf(kind), id + '.md'); if (!fs.existsSync(file)) return false;
  const trash = p('trash', kind); fs.mkdirSync(trash, { recursive: true });
  fs.renameSync(file, path.join(trash, `${id}.${Date.now()}.md`)); return true;
}
export function uniqueId(kind, title) {
  const dir = dirOf(kind); let base = slugify(title) || 'untitled', id = base, n = 2;
  while (fs.existsSync(path.join(dir, id + '.md'))) id = `${base}-${n++}`;
  return id;
}
function normalise(data) {
  const d = { ...data };
  if (d.date instanceof Date) d.date = d.date.toISOString().slice(0, 10);
  return d;
}
export function projectsIndex() {
  const out = {};
  for (const { id, data } of list('projects')) out[id] = { id, title: data.title || id, summary: data.summary || '', color: data.color || 'teal', lampX: data.lampX ?? 78, lampY: data.lampY ?? 34, order: data.order ?? 99, draft: !!data.draft };
  return out;
}
