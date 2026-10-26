import { syncEpisodes } from '../../lib/episodes.mjs';
import { readJson, p } from '../../lib/util.mjs';

// Fetches the podcast feed when the cache is older than 12 hours (or SYNC_EPISODES=1), otherwise uses the cache.
export default async function () {
  const site = readJson(p('src/_data/site.json'), {});
  const map = readJson(p('src/_data/episodeMap.json'), {});
  const data = await syncEpisodes(site.podcastRss, { force: process.env.SYNC_EPISODES === '1' });
  if (data.error) console.warn('[episodes] using cached feed:', data.error);
  const list = (data.episodes || []).filter(e => !map[e.guid]?.hidden).map(e => ({ ...e, project: map[e.guid]?.project || '', scripture: map[e.guid]?.scripture || '', featured: !!map[e.guid]?.featured }));

  // How many episodes to show per page on /listen/ (set in the console under Settings)
  const per = Math.min(60, Math.max(3, parseInt(site.listen?.perPage, 10) || 12));
  const featured = list.filter(e => e.featured).slice(0, 3);
  const rest = list.filter(e => !featured.includes(e));
  const total = Math.max(1, Math.ceil(rest.length / per));
  const pages = Array.from({ length: total }, (_, i) => ({ n: i + 1, total, items: rest.slice(i * per, (i + 1) * per), prev: i > 0 ? i : 0, next: i + 1 < total ? i + 2 : 0 }));
  const spotlight = featured.length ? featured : list.slice(0, 3);
  return { channel: data.channel || {}, fetchedAt: data.fetchedAt, episodes: list, featured, spotlight, spotlightLabel: featured.length ? 'Featured' : 'Latest', pages, perPage: per };
}
