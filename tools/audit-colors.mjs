// Checks every text/background and graphic pair in both themes against WCAG. Run: node tools/audit-colors.mjs
import fs from 'node:fs';
const t = JSON.parse(fs.readFileSync('design/tokens.json', 'utf8'));
const themes = t.color.themes.map(x => x.id);
const get = (n, th) => { const k = t.color.tokens.find(c => c.name === n); if (!k) throw new Error('missing token ' + n); return typeof k.value === 'string' ? k.value : (k.value[th] ?? k.value[themes[0]]); };
const lum = h => { h = h.replace('#', '').slice(0, 6); const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// [foreground, background, minimum, what it is]
const pairs = [
  ['ink', 'paper', 4.5, 'body text'], ['ink', 'paper-raised', 4.5, 'text on cards'], ['ink', 'paper-sunk', 4.5, 'text on wells'],
  ['ink-muted', 'paper', 4.5, 'meta text'], ['ink-muted', 'paper-raised', 4.5, 'meta on cards'], ['ink-muted', 'paper-sunk', 4.5, 'meta on wells'],
  ['accent-text', 'paper', 4.5, 'references and verse numbers'], ['accent-text', 'paper-raised', 4.5, 'references on passage blocks'],
  ['link', 'paper', 4.5, 'links'], ['link', 'paper-raised', 4.5, 'links on cards'],
  ['on-action', 'action', 4.5, 'primary button'], ['on-teal', 'teal', 4.5, 'gather chip, pray prompt'], ['on-teal', 'teal-deep', 4.5, 'template text'],
  ['on-gold', 'gold', 4.5, 'listen chip'], ['on-ember', 'ember', 4.5, 'kids chip'], ['on-sage', 'sage', 4.5, 'read chip, talk prompt'], ['on-blush', 'blush', 4.5, 'watch chip, sit prompt'],
  ['success', 'paper', 4.5, 'status'], ['warning', 'paper', 4.5, 'status'], ['danger', 'paper', 4.5, 'status'],
  ['line-strong', 'paper', 3, 'control borders'], ['line-strong', 'paper-raised', 3, 'control borders on cards'],
  ['focus', 'paper', 3, 'focus ring'], ['focus', 'paper-raised', 3, 'focus ring on cards'], ['focus', 'paper-sunk', 3, 'focus ring on wells'],
  ['gold', 'teal-deep', 3, 'lamp on template ground'], ['ember-light', 'teal-deep', 3, 'right page on template ground'], ['on-teal', 'teal-deep', 3, 'left page on template ground'],
  ['ink-muted', 'paper-sunk', 4.5, 'captions'],
  ['on-action', 'action-hover', 4.5, 'primary button on hover'], ['teal-deep', 'on-teal', 4.5, 'gold and outline buttons on hover'],
];
let fails = 0;
for (const th of themes) {
  console.log(`\n${th} theme`);
  for (const [f, b, min, what] of pairs) {
    const r = ratio(get(f, th), get(b, th)); const ok = r >= min; if (!ok) fails++;
    console.log(`${ok ? 'pass' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1 (need ${min})  ${f} on ${b}  ${what}`);
  }
}
console.log(fails ? `\n${fails} pair(s) fail` : '\nAll pairs pass in every theme');
process.exit(fails ? 1 : 0);
