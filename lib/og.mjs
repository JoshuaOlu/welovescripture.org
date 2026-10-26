// Social preview images (1200 x 630), drawn from the brand: deep teal, gold lamp and rings.
import fs from 'node:fs';
import crypto from 'node:crypto';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { p } from './util.mjs';

// Artwork from the podcast feed: downloaded once and kept in .cache/art. Returns null if it cannot be used.
async function loadArt(url) {
  try {
    const key = crypto.createHash('sha1').update(url).digest('hex').slice(0, 20); const file = p('.cache/art', key);
    let buf; if (fs.existsSync(file)) buf = fs.readFileSync(file);
    else { const r = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'WeLoveScriptureSite/1.0' } }); if (!r.ok) return null; buf = Buffer.from(await r.arrayBuffer()); fs.mkdirSync(p('.cache/art'), { recursive: true }); fs.writeFileSync(file, buf); }
    const mime = buf[0] === 0x89 && buf[1] === 0x50 ? 'image/png' : buf[0] === 0xff && buf[1] === 0xd8 ? 'image/jpeg' : buf.slice(0, 3).toString() === 'GIF' ? 'image/gif' : null;
    if (!mime) return null;
    return { uri: `data:${mime};base64,${buf.toString('base64')}`, hash: crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12) };
  } catch { return null; }
}

let fonts = null;
function loadFonts() {
  if (fonts) return fonts;
  const f = n => fs.readFileSync(p('src/assets/fonts/og', n));
  fonts = [
    { name: 'Fraunces', data: f('Fraunces-Display.ttf'), weight: 600, style: 'normal' },
    { name: 'Figtree', data: f('Figtree-500.ttf'), weight: 500, style: 'normal' },
    { name: 'Figtree', data: f('Figtree-700.ttf'), weight: 700, style: 'normal' },
  ];
  return fonts;
}
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 90" width="112" height="90"><g transform="translate(-4 -11)" stroke-linejoin="round" stroke-width="8"><path d="M54 96 C43 87 26 84 12 88 L12 43 C26 39 43 42 54 52 Z" fill="#FBF6EC" stroke="#FBF6EC"/><path d="M66 96 C77 87 94 84 108 88 L108 43 C94 39 77 42 66 52 Z" fill="#E8815B" stroke="#E8815B"/><circle cx="60" cy="27" r="12" fill="#F2B134"/></g></svg>`;
const MARK_URI = 'data:image/svg+xml;base64,' + Buffer.from(MARK).toString('base64');
const h = (type, style, children, extra = {}) => ({ type, props: { style, children, ...extra } });

// Deterministic lamp position so every page looks related but not identical.
function lampFor(seed) {
  const n = parseInt(crypto.createHash('md5').update(seed).digest('hex').slice(0, 6), 16);
  const spots = [[930, 150], [980, 330], [900, 470], [1010, 120], [940, 250]];
  return spots[n % spots.length];
}

export async function renderOg({ title, kicker = '', seed = '', domain = 'welovescripture.org', siteName = 'We Love Scripture', artUri = '' }) {
  const [cx, cy] = artUri ? [1010, 120] : lampFor(seed || title);
  const len = title.length; const size = artUri ? (len <= 24 ? 84 : len <= 40 ? 70 : len <= 64 ? 58 : 48) : (len <= 24 ? 104 : len <= 40 ? 88 : len <= 64 ? 72 : 60);
  const rings = [1, 2, 3, 4, 5].map(i => {
    const r = 70 + i * 62;
    return h('div', { position: 'absolute', left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: '50%', border: '3px solid rgba(242,177,52,0.30)' });
  });
  const lamp = h('div', { position: 'absolute', left: cx - 50, top: cy - 50, width: 100, height: 100, borderRadius: '50%', background: '#F2B134' });
  const tree = h('div', { position: 'relative', display: 'flex', width: 1200, height: 630, background: '#0E4A47', overflow: 'hidden' }, [
    ...rings, lamp,
    ...(artUri ? [h('img', { position: 'absolute', left: 700, top: 120, width: 400, height: 400, borderRadius: 40, objectFit: 'cover', border: '6px solid #FBF6EC' }, '', { src: artUri, width: 400, height: 400 })] : []),
    h('div', { position: 'absolute', left: 72, top: 64, display: 'flex', flexDirection: 'column', width: artUri ? 580 : 760, height: 502, justifyContent: 'space-between' }, [
      h('div', { display: 'flex', flexDirection: 'column' }, [
        kicker ? h('div', { display: 'flex', alignSelf: 'flex-start', background: '#F2B134', color: '#0F2E2C', fontFamily: 'Figtree', fontWeight: 700, fontSize: 26, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 24px', borderRadius: 999, marginBottom: 36 }, kicker) : h('div', { display: 'flex' }, ''),
        h('div', { display: 'flex', fontFamily: 'Fraunces', fontWeight: 600, fontSize: size, lineHeight: 1.04, letterSpacing: '-0.02em', color: '#FBF6EC' }, title),
      ]),
      h('div', { display: 'flex', alignItems: 'center' }, [
        h('img', { width: 84, height: 68, marginRight: 22 }, '', { src: MARK_URI, width: 84, height: 68 }),
        h('div', { display: 'flex', flexDirection: 'column' }, [
          h('div', { display: 'flex', fontFamily: 'Fraunces', fontWeight: 600, fontSize: 38, color: '#FBF6EC' }, siteName),
          h('div', { display: 'flex', fontFamily: 'Figtree', fontWeight: 500, fontSize: 26, color: '#B4C3BC' }, domain),
        ]),
      ]),
    ]),
  ]);
  const svg = await satori(tree, { width: 1200, height: 630, fonts: loadFonts() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

const cacheDir = () => { const d = p('.cache/og'); fs.mkdirSync(d, { recursive: true }); return d; };
export async function renderOgCached(job) {
  const { art, ...rest } = job; const loaded = art ? await loadArt(art) : null;
  const key = crypto.createHash('sha1').update(JSON.stringify(rest) + (loaded ? 'art:' + loaded.hash : '') + 'v2').digest('hex').slice(0, 16);
  const file = p('.cache/og', key + '.png');
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const png = await renderOg({ ...rest, artUri: loaded?.uri || '' }); cacheDir(); fs.writeFileSync(file, png); return png;
}
