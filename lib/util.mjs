import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const p = (...a) => path.join(ROOT, ...a);

export function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
export function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function stripMarkdown(s) {
  return String(s || '')
    .replace(/^:::.*$/gm, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~]/g, '').replace(/^\s*\d{1,3}\s+/gm, '').replace(/\s+/g, ' ').trim();
}
export function truncate(s, n = 158) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1); const i = cut.lastIndexOf(' ');
  return (i > n * 0.6 ? cut.slice(0, i) : cut).replace(/[,;:\-–—\s]+$/, '') + '…';
}
export const TYPES = {
  read: { label: 'Read', dir: 'read', icon: 'read' },
  gather: { label: 'Gather', dir: 'guides', icon: 'gather' },
  watch: { label: 'Watch', dir: 'watch', icon: 'watch' },
  listen: { label: 'Listen', dir: 'listen', icon: 'listen' },
  kids: { label: 'Kids', dir: 'kids', icon: 'kids' },
};
