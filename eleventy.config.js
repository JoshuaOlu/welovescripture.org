import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createMarkdown, readingMinutes } from './lib/markdown.mjs';
import { pageMeta, seoHeadHtml, ogSlug, ytId } from './lib/seo.mjs';
import { renderOgCached } from './lib/og.mjs';
import { TYPES, esc, readJson } from './lib/util.mjs';
import { ICONS } from './lib/icons.mjs';

const DRAFTS = process.env.DRAFTS === '1';

export default function (eleventyConfig) {
  eleventyConfig.setLibrary('md', createMarkdown());
  eleventyConfig.addPreprocessor('drafts', '*', data => { if (data.draft && !DRAFTS) return false; });

  eleventyConfig.addPassthroughCopy('src/assets');
  eleventyConfig.addPassthroughCopy('src/favicon.ico');
  eleventyConfig.addPassthroughCopy('src/favicon.svg');
  eleventyConfig.addPassthroughCopy({ 'src/well-known': '.well-known' });
  if (fs.existsSync('CNAME')) eleventyConfig.addPassthroughCopy({ CNAME: 'CNAME' });
  eleventyConfig.addWatchTarget('src/assets/css/');
  eleventyConfig.ignores.add('src/og-cache/**');

  // ---- filters
  const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  eleventyConfig.addFilter('dateDisplay', d => (d ? fmt.format(new Date(d)) : ''));
  eleventyConfig.addFilter('isoDate', d => (d ? new Date(d).toISOString() : ''));
  eleventyConfig.addFilter('year', d => new Date(d).getUTCFullYear());
  eleventyConfig.addFilter('readingTime', raw => readingMinutes(raw));
  eleventyConfig.addFilter('typeLabel', t => TYPES[t]?.label || t);
  eleventyConfig.addFilter('typeDir', t => TYPES[t]?.dir || 'read');
  eleventyConfig.addFilter('byProject', (list, id) => (list || []).filter(r => r.data.project === id));
  eleventyConfig.addFilter('epByProject', (list, id) => (list || []).filter(e => e.project === id));
  eleventyConfig.addFilter('ofType', (list, ...types) => (list || []).filter(r => types.includes(r.data.type)));
  eleventyConfig.addFilter('limit', (list, n) => (list || []).slice(0, n));
  eleventyConfig.addFilter('urlencode', s => encodeURIComponent(s || ''));
  eleventyConfig.addFilter('ytId', ytId);
  eleventyConfig.addFilter('absolute', (u, site) => (/^https?:/.test(u) ? u : site.url.replace(/\/$/, '') + u));
  eleventyConfig.addFilter('lamp', slug => {
    const spots = [[78, 34], [84, 62], [70, 28], [88, 40], [74, 66], [82, 24]];
    const n = parseInt(crypto.createHash('md5').update(String(slug)).digest('hex').slice(0, 4), 16);
    return { x: spots[n % spots.length][0], y: spots[n % spots.length][1] };
  });
  eleventyConfig.addFilter('siblings', (list, projectId, url) => {
    const all = (list || []).filter(r => r.data.project === projectId).sort((a, b) => ((a.data.order ?? 99) - (b.data.order ?? 99)) || (a.date - b.date));
    const i = all.findIndex(r => r.url === url);
    return { all, prev: i > 0 ? all[i - 1] : null, next: i >= 0 && i < all.length - 1 ? all[i + 1] : null, index: i + 1 };
  });
  eleventyConfig.addFilter('sortProject', list => [...(list || [])].sort((a, b) => ((a.data.order ?? 99) - (b.data.order ?? 99)) || (a.date - b.date)));
  eleventyConfig.addFilter('counterValue', (item, collections, episodes) => {
    if (!item.source?.startsWith('auto:')) return item.value || 0;
    const k = item.source.slice(5);
    return ({ episodes: episodes?.episodes?.length, guides: collections.gather?.length, articles: collections.read?.length, videos: collections.watch?.length, projects: collections.projects?.length, resources: collections.resources?.length })[k] || 0;
  });
  eleventyConfig.addFilter('stripTags', s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  eleventyConfig.addFilter('currentYear', () => new Date().getUTCFullYear());
  eleventyConfig.addFilter('shownOnly', items => (items || []).filter(i => i.show));
  eleventyConfig.addFilter('except', (list, url) => (list || []).filter(r => r.url !== url));
  eleventyConfig.addFilter('dump', o => JSON.stringify(o));

  // ---- shortcodes
  eleventyConfig.addShortcode('icon', (name, cls = '') => `<svg class="icon ${esc(cls)}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`);
  eleventyConfig.addShortcode('seoHead', function () {
    // Register this page's social image while it renders, when the page's own data (episode, page number) is available.
    try { const m = pageMeta(this.ctx, this.page.url); if (m.ogJob) ogJobs.set(ogSlug(this.page.url), m.ogJob); } catch {}
    return seoHeadHtml(this.ctx, this.page.url);
  });
  eleventyConfig.addShortcode('mark', (h = 34) => `<svg class="brand-mark" viewBox="0 0 112 90" style="height:${h}px;width:auto" aria-hidden="true" focusable="false"><g transform="translate(-4 -11)" stroke-linejoin="round" stroke-width="8"><path d="M54 96 C43 87 26 84 12 88 L12 43 C26 39 43 42 54 52 Z" class="mk-l"/><path d="M66 96 C77 87 94 84 108 88 L108 43 C94 39 77 42 66 52 Z" class="mk-r"/><circle cx="60" cy="27" r="12" class="mk-d"/></g></svg>`);

  // ---- collections
  const byDate = (a, b) => b.date - a.date;
  eleventyConfig.addCollection('resources', api => api.getFilteredByTag('resource').sort(byDate));
  for (const t of Object.keys(TYPES)) eleventyConfig.addCollection(t, api => api.getFilteredByTag('resource').filter(r => r.data.type === t).sort(byDate));
  eleventyConfig.addCollection('projects', api => api.getFilteredByTag('project').sort((a, b) => ((a.data.order ?? 99) - (b.data.order ?? 99)) || a.data.title.localeCompare(b.data.title)));
  const ogJobs = new Map(); let pdfJobs = [];
  eleventyConfig.addCollection('pdfJobs', api => (pdfJobs = api.getFilteredByTag('resource').filter(r => r.data.type === 'gather' && r.data.pdf !== false).map(r => ({ url: r.url, slug: r.fileSlug, title: r.data.title }))));

  // ---- after build: social images, PDFs, then the search index
  eleventyConfig.on('eleventy.after', async ({ dir }) => {
    const out = path.join(dir.output, 'og'); fs.mkdirSync(out, { recursive: true });
    let made = 0;
    for (const [slug, job] of ogJobs) { fs.writeFileSync(path.join(out, slug + '.png'), await renderOgCached(job)); made++; }
    if (made) console.log(`[og] ${made} social images`);
    if (process.env.PDF === '1') {
      try {
        const { buildPdfs } = await import('./lib/pdf.mjs');
        const host = new URL(readJson('src/_data/site.json').url).host;
        const r = await buildPdfs(pdfJobs.map(j => ({ ...j, host })), dir.output);
        if (r.made || r.cached) console.log(`[pdf] ${r.made} made, ${r.cached} reused from cache`);
      } catch (e) { console.warn('[pdf] failed:', e.message); }
    }
    if (process.env.SKIP_SEARCH !== '1') {
      try {
        const pagefind = await import('pagefind');
        const { index } = await pagefind.createIndex({});
        await index.addDirectory({ path: dir.output });
        await index.writeFiles({ outputPath: path.join(dir.output, 'pagefind') });
        await pagefind.close();
      } catch (e) { console.warn('[search] skipped:', e.message); }
    }
  });

  return {
    dir: { input: 'src', output: '_site', includes: '_includes', data: '_data' },
    markdownTemplateEngine: false, htmlTemplateEngine: 'njk', templateFormats: ['njk', 'md', 'html'],
  };
}
