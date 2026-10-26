// Builds src/assets/css/tokens.css from design/tokens.json. Run: node tools/build-tokens.mjs
import fs from 'node:fs';
const t = JSON.parse(fs.readFileSync('design/tokens.json', 'utf8'));
const css = ['/* We Love Scripture: generated from design/tokens.json. Do not edit by hand. */'];
for (const f of t.type.fonts) {
  css.push(`@font-face{font-family:'${f.family}';src:url('/assets/fonts/${f.file.replace('fonts/', '')}') format('woff2');font-weight:${f.weight};font-style:${f.style};font-display:swap}`);
}
const themes = t.color.themes.map(x => x.id);
const val = (tok, th) => (typeof tok.value === 'string' ? tok.value : (tok.value[th] ?? tok.value[themes[0]]));
themes.forEach((th, i) => {
  const sel = i === 0 ? `:root,[data-theme="${th}"]` : `[data-theme="${th}"]`;
  css.push(`${sel}{color-scheme:${th};` + t.color.tokens.map(c => `--${c.name}:${val(c, th)};`).join('') + '}');
});
let root = '';
for (const fam of ['spacing', 'radius', 'shadow', 'layout']) for (const c of t[fam].tokens) root += `--${c.name}:${c.value};`;
for (const [k, v] of Object.entries(t.type.families)) root += `--font-${k}:${v};`;
css.push(`:root{${root}}`);
for (const g of t.type.groups) for (const s of g.styles) {
  const fam = s.family || g.family;
  let d = `font-family:var(--font-${fam});font-size:${s.fontSize};line-height:${s.lineHeight};font-weight:${s.fontWeight};`;
  if (s.letterSpacing) d += `letter-spacing:${s.letterSpacing};`;
  if (s.fontStyle) d += `font-style:${s.fontStyle};`;
  css.push(`.${s.name}{${d}}`);
}
fs.writeFileSync('src/assets/css/tokens.css', css.join('\n') + '\n');
console.log('tokens.css written');
