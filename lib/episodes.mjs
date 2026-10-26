// Podcast feed reader: turns the RSS feed into episode data, with an offline cache.
import fs from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { p, slugify, readJson, writeJson } from './util.mjs';

const CACHE = () => p('src/_data/episodes.cache.json');
export function sanitize(html) {
  let s = String(html || '').replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<a\s[^>]*href=("|')(https?:\/\/[^"']+)\1[^>]*>/gi, '<a href="$2" rel="noopener">');
  s = s.replace(/<(?!\/?(p|br|a|strong|b|em|i|ul|ol|li)\b)[^>]+>/gi, '');
  s = s.replace(/<(p|br|strong|b|em|i|ul|ol|li)\s[^>]*>/gi, '<$1>');
  return s.trim();
}
const text = v => (v && typeof v === 'object' ? (v['#text'] ?? '') : v ?? '').toString().trim();
function seconds(d) {
  if (d == null || d === '') return 0; d = String(d);
  if (/^\d+$/.test(d)) return +d;
  const parts = d.split(':').map(Number); if (parts.some(isNaN)) return 0;
  return parts.reduce((a, n) => a * 60 + n, 0);
}
export function parseFeed(xml) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', processEntities: true });
  const ch = parser.parse(xml)?.rss?.channel; if (!ch) throw new Error('Not a podcast feed');
  const items = [].concat(ch.item || []);
  const used = new Set();
  const episodes = items.map(it => {
    let title = text(it.title); let season = it['itunes:season'], episode = it['itunes:episode'];
    const m = /^S(\d+)E(\d+)\s*[-–:]\s*/i.exec(title);
    if (m) { season ??= +m[1]; episode ??= +m[2]; title = title.slice(m[0].length); }
    let slug = slugify(title) || 'episode'; let n = 2; const base = slug; while (used.has(slug)) slug = `${base}-${n++}`; used.add(slug);
    const secs = seconds(text(it['itunes:duration']));
    return {
      slug, title, guid: text(it.guid), date: new Date(text(it.pubDate)).toISOString(),
      season: season ? +season : null, episode: episode ? +episode : null,
      description: sanitize(text(it['content:encoded']) || text(it.description)),
      audio: it.enclosure?.['@_url'] || '', audioType: it.enclosure?.['@_type'] || 'audio/mpeg', bytes: +(it.enclosure?.['@_length'] || 0),
      seconds: secs, minutes: Math.max(1, Math.round(secs / 60)),
      image: it['itunes:image']?.['@_href'] || '', link: text(it.link),
    };
  }).filter(e => e.audio).sort((a, b) => b.date.localeCompare(a.date));
  return {
    channel: { title: text(ch.title), description: text(ch.description), author: text(ch['itunes:author']), language: text(ch.language) || 'en', image: ch['itunes:image']?.['@_href'] || ch.image?.url || '', link: text(ch.link) },
    episodes,
  };
}
export async function fetchFeed(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'WeLoveScriptureSite/1.0' }, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error('Feed returned ' + res.status);
  return parseFeed(await res.text());
}
export async function syncEpisodes(url, { force = false, maxAgeHours = 12 } = {}) {
  const cached = readJson(CACHE(), null);
  const fresh = cached?.fetchedAt && (Date.now() - Date.parse(cached.fetchedAt)) < maxAgeHours * 3600e3;
  if (cached && fresh && !force) return { ...cached, source: 'cache' };
  try {
    const feed = await fetchFeed(url); const out = { fetchedAt: new Date().toISOString(), url, ...feed };
    writeJson(CACHE(), out); return { ...out, source: 'live' };
  } catch (err) {
    if (cached) return { ...cached, source: 'cache', error: err.message };
    return { fetchedAt: null, channel: {}, episodes: [], source: 'none', error: err.message };
  }
}
