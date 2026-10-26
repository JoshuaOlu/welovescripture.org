// Everything a search engine, a social card or an AI assistant should know about a page.
import { esc, truncate, stripMarkdown, TYPES } from './util.mjs';

const plain = html => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
export const ytId = v => { const m = /(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/.exec(v || '') || /^([\w-]{11})$/.exec(v || ''); return m ? m[1] : ''; };
const iso = d => { try { return new Date(d).toISOString(); } catch { return undefined; } };
const dur = s => { s = +s || 0; const m = Math.floor(s / 60), r = s % 60; return `PT${m}M${r}S`; };

export function ogSlug(url) { return url === '/' ? 'home' : url.replace(/^\/|\/$/g, '').replace(/\//g, '-'); }

export function pageMeta(d, url) {
  const site = d.site, base = site.url.replace(/\/$/, '');
  const abs = u => (/^https?:/.test(u) ? u : base + (u.startsWith('/') ? u : '/' + u));
  const kind = d.kind || 'page', ep = d.ep, isHome = url === '/';
  const typ = TYPES[d.type];
  const project = d.project ? d.projectsIndex?.[d.project] : null;
  const title = ep ? ep.title : (d.title || site.name);
  const description = truncate(ep ? plain(ep.description) : (d.description || d.summary || site.description), 158);
  const fullTitle = isHome ? `${site.name} | ${site.tagline}` : `${title} | ${site.name}`;
  const canonical = base + url;
  const generated = !(d.image && !ep);
  const ogUrl = generated ? `${base}/og/${ogSlug(url)}.png` : abs(d.image);
  const kicker = ep ? ['Listen', project?.title].filter(Boolean).join(' · ')
    : kind === 'project' ? 'Project' : (typ ? [typ.label, project?.title].filter(Boolean).join(' · ') : '');
  const ogJob = generated ? { title: isHome ? site.tagline : title, kicker: isHome ? '' : kicker, seed: url, domain: new URL(base).host, siteName: site.name } : null;
  const published = iso(ep ? ep.date : d.date), modified = iso(d.updated || (ep ? ep.date : d.date));

  const org = { '@type': 'Organization', '@id': base + '/#org', name: site.name, url: base + '/', logo: { '@type': 'ImageObject', url: base + '/assets/img/icon-512.png', width: 512, height: 512 }, sameAs: Object.values(site.social || {}).filter(Boolean) };
  const web = { '@type': 'WebSite', '@id': base + '/#website', url: base + '/', name: site.name, description: site.description, inLanguage: site.locale || 'en', publisher: { '@id': base + '/#org' },
    potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: base + '/search/?q={search_term_string}' }, 'query-input': 'required name=search_term_string' } };
  const graph = [org, web];
  const crumbs = [['Home', '/']];
  if (kind === 'project') crumbs.push(['Projects', '/projects/'], [title, url]);
  else if (kind === 'resource') { if (project) crumbs.push([project.title, `/projects/${project.id}/`]); else crumbs.push([typ?.label || 'Resources', `/${typ?.dir || 'read'}/`]); crumbs.push([title, url]); }
  else if (kind === 'episode') crumbs.push(['Listen', '/listen/'], [title, url]);
  else if (!isHome) crumbs.push([title, url]);
  if (crumbs.length > 1) graph.push({ '@type': 'BreadcrumbList', itemListElement: crumbs.map(([name, u], i) => ({ '@type': 'ListItem', position: i + 1, name, item: base + u })) });

  const common = { '@id': canonical + '#page', url: canonical, name: title, description, inLanguage: site.locale || 'en', isPartOf: { '@id': base + '/#website' }, primaryImageOfPage: { '@type': 'ImageObject', url: ogUrl, width: 1200, height: 630 } };
  if (kind === 'resource' && d.type === 'watch' && ytId(d.youtube)) {
    const id = ytId(d.youtube);
    graph.push({ '@type': 'VideoObject', ...common, '@id': canonical + '#video', thumbnailUrl: [`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`], uploadDate: published, embedUrl: `https://www.youtube.com/embed/${id}`, contentUrl: `https://www.youtube.com/watch?v=${id}`, publisher: { '@id': base + '/#org' } });
  } else if (kind === 'resource') {
    graph.push({ '@type': 'Article', ...common, '@id': canonical + '#article', headline: truncate(title, 110), image: [ogUrl], datePublished: published, dateModified: modified, author: { '@id': base + '/#org' }, publisher: { '@id': base + '/#org' }, mainEntityOfPage: canonical, articleSection: typ?.label, keywords: (d.tags || []).join(', ') || undefined, ...(project ? { isPartOf: { '@type': 'CollectionPage', name: project.title, url: `${base}/projects/${project.id}/` } } : {}) });
  } else if (kind === 'episode') {
    graph.push({ '@type': 'PodcastEpisode', ...common, '@id': canonical + '#episode', datePublished: published, timeRequired: dur(ep.seconds), episodeNumber: ep.episode || undefined, image: ep.image || ogUrl,
      partOfSeries: { '@type': 'PodcastSeries', name: site.name + ' podcast', url: base + '/listen/', webFeed: site.podcastRss },
      associatedMedia: { '@type': 'AudioObject', contentUrl: ep.audio, encodingFormat: ep.audioType, duration: dur(ep.seconds) }, publisher: { '@id': base + '/#org' } });
  } else if (kind === 'listen') {
    graph.push({ '@type': 'PodcastSeries', ...common, '@id': canonical + '#series', name: site.name + ' podcast', webFeed: site.podcastRss, image: d.episodesMeta?.channel?.image || ogUrl, author: { '@id': base + '/#org' }, sameAs: [site.social?.apple, site.social?.spotify].filter(Boolean) });
  } else if (kind === 'project' || kind === 'listing') {
    graph.push({ '@type': 'CollectionPage', ...common });
  } else if (!isHome) {
    graph.push({ '@type': kind === 'about' ? 'AboutPage' : 'WebPage', ...common });
  } else {
    graph.push({ '@type': 'WebPage', ...common });
  }
  return { title, fullTitle, description, canonical, image: ogUrl, imageGenerated: generated, imageAlt: `${title}: ${site.name}`, ogType: (kind === 'resource' || kind === 'episode') ? 'article' : 'website', published, modified, graph: { '@context': 'https://schema.org', '@graph': graph }, ogJob, noindex: !!d.noindex };
}

export function seoHeadHtml(d, url) {
  const m = pageMeta(d, url), site = d.site, base = site.url.replace(/\/$/, '');
  const tw = (site.social?.x || '').split('/').pop();
  const meta = (n, c) => c ? `<meta name="${n}" content="${esc(c)}">` : '';
  const prop = (n, c) => c ? `<meta property="${n}" content="${esc(c)}">` : '';
  const v = site.verification || {};
  return [
    `<title>${esc(m.fullTitle)}</title>`,
    meta('description', m.description),
    `<link rel="canonical" href="${esc(m.canonical)}">`,
    meta('robots', m.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'),
    // Ask AI companies not to train on this site (answering questions with it is welcome).
    meta('robots', 'noai, noimageai'), meta('tdm-reservation', '1'), meta('tdm-policy', base + '/ai-policy/'),
    prop('og:type', m.ogType), prop('og:site_name', site.name), prop('og:title', m.title), prop('og:description', m.description), prop('og:url', m.canonical), prop('og:locale', (site.locale || 'en') === 'en' ? 'en_US' : site.locale),
    prop('og:image', m.image), prop('og:image:secure_url', m.image), prop('og:image:type', m.image.endsWith('.png') ? 'image/png' : undefined), prop('og:image:width', '1200'), prop('og:image:height', '630'), prop('og:image:alt', m.imageAlt),
    ...(m.ogType === 'article' ? [prop('article:published_time', m.published), prop('article:modified_time', m.modified), prop('article:author', site.name)] : []),
    meta('twitter:card', 'summary_large_image'), meta('twitter:site', tw ? '@' + tw : ''), meta('twitter:title', m.title), meta('twitter:description', m.description), meta('twitter:image', m.image), meta('twitter:image:alt', m.imageAlt),
    meta('google-site-verification', v.google), meta('msvalidate.01', v.bing),
    '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#FBF6EC"><meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0A2221">',
    '<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">',
    `<link rel="alternate" type="application/atom+xml" title="${esc(site.name)} resources" href="${base}/feed.xml">`,
    site.podcastRss ? `<link rel="alternate" type="application/rss+xml" title="${esc(site.name)} podcast" href="${esc(site.podcastRss)}">` : '',
    `<script type="application/ld+json">${JSON.stringify(m.graph).replace(/</g, '\\u003c')}</script>`,
  ].filter(Boolean).join('\n');
}
