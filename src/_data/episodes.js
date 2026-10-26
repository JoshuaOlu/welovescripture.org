import { syncEpisodes } from '../../lib/episodes.mjs';
import { readJson, p } from '../../lib/util.mjs';

// Fetches the podcast feed when the cache is older than 12 hours (or SYNC_EPISODES=1), otherwise uses the cache.
export default async function () {
  const site = readJson(p('src/_data/site.json'), {});
  const map = readJson(p('src/_data/episodeMap.json'), {});
  const data = await syncEpisodes(site.podcastRss, { force: process.env.SYNC_EPISODES === '1' });
  if (data.error) console.warn('[episodes] using cached feed:', data.error);
  // Preview image per episode: 'auto' (made by the site), 'feed' (the podcast's own artwork) or 'custom' (a picture you chose).
  // An episode can choose its own; otherwise it follows the default in Settings.
  const defMode = ['auto', 'feed', 'custom'].includes(site.listen?.defaultImage) ? site.listen.defaultImage : 'auto';
  const defCustom = site.listen?.defaultImageUrl || '';
  const resolveImage = e => {
    const m = map[e.guid] || {}; let mode = ['auto', 'feed', 'custom'].includes(m.imageMode) ? m.imageMode : defMode;
    const custom = m.imageMode === 'custom' ? (m.image || '') : (m.imageMode ? '' : defCustom);
    const art = e.image || data.channel?.image || '';
    if (mode === 'custom' && !custom) mode = 'auto';
    if (mode === 'feed' && !art) mode = 'auto';
    return { imageMode: mode, artUrl: mode === 'feed' ? art : '', customSrc: mode === 'custom' ? custom : '', previewSrc: mode === 'custom' ? custom : `/og/listen-${e.slug}.png` };
  };
  const list = (data.episodes || []).filter(e => !map[e.guid]?.hidden).map(e => ({ ...e, project: map[e.guid]?.project || '', scripture: map[e.guid]?.scripture || '', featured: !!map[e.guid]?.featured, ...resolveImage(e) }));

  // Two episodes with the same title would look identical in search results, so the page title of the repeats gets the date.
  const seen = {}; for (const e of list) seen[e.title.trim().toLowerCase()] = (seen[e.title.trim().toLowerCase()] || 0) + 1;
  for (const e of list) if (seen[e.title.trim().toLowerCase()] > 1) e.seoTitle = `${e.title} (${new Date(e.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })})`;

  // How many episodes to show per page on /listen/ (set in the console under Settings)
  const per = Math.min(60, Math.max(3, parseInt(site.listen?.perPage, 10) || 12));
  const featured = list.filter(e => e.featured).slice(0, 3);
  const rest = list.filter(e => !featured.includes(e));
  const total = Math.max(1, Math.ceil(rest.length / per));
  const pages = Array.from({ length: total }, (_, i) => ({ n: i + 1, total, items: rest.slice(i * per, (i + 1) * per), prev: i > 0 ? i : 0, next: i + 1 < total ? i + 2 : 0 }));
  const spotlight = featured.length ? featured : list.slice(0, 3);
  return { channel: data.channel || {}, fetchedAt: data.fetchedAt, episodes: list, featured, spotlight, spotlightLabel: featured.length ? 'Featured' : 'Latest', pages, perPage: per };
}
