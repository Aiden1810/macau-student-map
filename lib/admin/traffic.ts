export type TrafficRange = '24h' | '7d' | '30d';
export type TrafficEvent = {created_at: string; session_id: string | null; path: string | null};
export type TrafficPoint = {timestamp: number; label: string; count: number};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MACAU_OFFSET = 8 * HOUR;

export function isPublicTrafficPath(path: string | null): boolean {
  if (!path?.startsWith('/')) return false;
  const segments = path.split(/[?#]/)[0].split('/').filter(Boolean);
  if (['zh-CN', 'zh-MO', 'en'].includes(segments[0])) segments.shift();
  return !['admin', 'admin-login', 'login', 'auth', 'api'].includes(segments[0]);
}

/** Use Macau calendar days, regardless of the administrator's device timezone. */
export function summarizeTraffic(events: TrafficEvent[], range: TrafficRange, now: number) {
  const step = range === '24h' ? HOUR : DAY;
  const floorBucket = (time: number) => Math.floor((time + MACAU_OFFSET) / step) * step - MACAU_OFFSET;
  const start = range === '24h' ? now - DAY : floorBucket(now) - (range === '7d' ? 6 : 29) * DAY;
  const buckets = new Map<number, TrafficPoint>();
  for (let time = floorBucket(start); time <= now; time += step) {
    const local = new Date(time + MACAU_OFFSET);
    const day = `${local.getUTCMonth() + 1}/${local.getUTCDate()}`;
    const label = range === '24h' ? `${day} ${String(local.getUTCHours()).padStart(2, '0')}:00` : day;
    buckets.set(time, {timestamp: time, label, count: 0});
  }
  const browsers = new Set<string>();
  const paths = new Map<string, number>();
  let pv = 0;
  let identifiedViews = 0;
  for (const event of events) {
    const time = Date.parse(event.created_at);
    if (!Number.isFinite(time) || time < start || time > now || !isPublicTrafficPath(event.path)) continue;
    pv += 1;
    const browser = event.session_id?.trim();
    if (browser) {browsers.add(browser); identifiedViews += 1;}
    const point = buckets.get(floorBucket(time));
    if (point) point.count += 1;
    const path = event.path!.split(/[?#]/)[0];
    paths.set(path, (paths.get(path) ?? 0) + 1);
  }
  const timeline = [...buckets.values()];
  const peakPoint = timeline.reduce<TrafficPoint | null>((peak, point) => point.count > (peak?.count ?? 0) ? point : peak, null);
  const topPages = [...paths].map(([path, count]) => ({path, count})).sort((a, b) => b.count - a.count || a.path.localeCompare(b.path)).slice(0, 5);
  return {pv, uv: browsers.size, identifiedViews, timeline, topPages, peakPoint};
}

export type TrafficSummary = ReturnType<typeof summarizeTraffic>;
