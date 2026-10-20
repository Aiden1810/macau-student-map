import {isPublicTrafficPath, summarizeTraffic, trafficStart, type TrafficRange} from './traffic';
import {isLocalHostname} from '../analytics/traffic-policy';
export {shouldTrackVisit} from '../analytics/traffic-policy';

export type CountItem = {label: string; count: number};
export type VisitRow = {
  id: string; created_at: string; path: string | null; session_id: string | null;
  user_agent: string | null; referrer: string | null; user_id: string | null;
};
export type QualityRow = {
  id: string; name: string; status: string; address: string | null;
  longitude: number | null; latitude: number | null;
  legacy_image_urls?: string[] | null; place_media: {lifecycle_status: string}[];
};
export type QualityFilter = 'all' | 'cover' | 'address' | 'coordinates';
export type QualityIssue = {id: string; name: string; reasons: string[]};
export type SearchRow = {query: string; normalized_query: string; result_count: number};

function ranking(counts: Map<string, number>): CountItem[] {
  return [...counts].map(([label, count]) => ({label, count}))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'));
}
function add(counts: Map<string, number>, key: string) {counts.set(key, (counts.get(key) ?? 0) + 1);}

export function deviceLabel(agent: string | null): string {
  if (!agent?.trim()) return '未知';
  if (/bot|crawler|spider|headless|playwright|puppeteer/i.test(agent)) return '疑似自动化';
  if (/ipad|tablet|android(?!.*mobile)/i.test(agent)) return '平板';
  if (/mobile|iphone|ipod/i.test(agent)) return '手机';
  if (/windows|macintosh|linux|x11|cros/i.test(agent)) return '电脑';
  return '未知';
}

export function sourceLabel(referrer: string | null): string {
  if (!referrer?.trim()) return '直接访问／来源未知';
  try {
    const url = new URL(referrer);
    if (!['http:', 'https:'].includes(url.protocol)) return '来源未知';
    return isLocalHostname(url.hostname) ? '本机来源（不代表访问环境）' : url.hostname;
  } catch {return '来源未知';}
}

export function summarizeVisits(rows: VisitRow[], range: TrafficRange, now: number) {
  const start = trafficStart(range, now);
  const visits = rows.filter(row => {
    const time = Date.parse(row.created_at);
    return time >= start && time <= now && isPublicTrafficPath(row.path);
  }).sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
  const devices = new Map<string, number>();
  const sources = new Map<string, number>();
  const pages = new Map<string, number>();
  const browsers = new Map<string, number>();
  for (const row of visits) {
    add(devices, deviceLabel(row.user_agent));
    add(sources, sourceLabel(row.referrer));
    const path = row.path!.split(/[?#]/)[0];
    const match = path.match(/^\/(?:zh-CN\/|zh-MO\/|en\/)?shop\/([^/]+)\/?$/);
    if (match) add(pages, match[1]);
    if (row.session_id?.trim()) add(browsers, row.session_id.trim());
  }
  // Labels are local to this report; raw browser identifiers are never sent to the dashboard.
  const browserLabels = new Map([...browsers.keys()].map((key, index) => [key, `浏览器 ${String(index + 1).padStart(2, '0')}`]));
  return {
    summary: summarizeTraffic(visits, range, now), devices: ranking(devices), sources: ranking(sources),
    placeViews: ranking(pages).map(({label, count}) => ({id: label, count})),
    frequentBrowsers: ranking(browsers).slice(0, 5).map(item => ({label: browserLabels.get(item.label)!, count: item.count})),
    localReferrerViews: sources.get('本机来源（不代表访问环境）') ?? 0,
    recent: visits.slice(0, 50).map(row => ({
      id: row.id, createdAt: row.created_at, path: row.path!.split(/[?#]/)[0].slice(0, 300),
      browser: row.session_id?.trim() ? browserLabels.get(row.session_id.trim())! : '无浏览器标识',
      device: deviceLabel(row.user_agent), source: sourceLabel(row.referrer), signedIn: Boolean(row.user_id)
    }))
  };
}

export function summarizeSearches(rows: SearchRow[]) {
  const popular = new Map<string, number>();
  const missing = new Map<string, number>();
  let missed = 0;
  let filterOnly = 0;
  for (const row of rows) {
    const keyword = (row.normalized_query || row.query).trim();
    if (keyword) add(popular, keyword);
    else filterOnly++;
    if (row.result_count === 0) {
      missed++;
      if (keyword) add(missing, keyword);
    }
  }
  return {total: rows.length, missed, filterOnly, popular: ranking(popular).slice(0, 10), missing: ranking(missing).slice(0, 10)};
}

export function summarizeQuality(rows: QualityRow[]) {
  const published = rows.filter(row => row.status === 'published');
  let missingCover = 0;
  let missingAddress = 0;
  let missingCoordinates = 0;
  const issues: QualityIssue[] = [];
  for (const row of published) {
    const reasons: string[] = [];
    if (!row.legacy_image_urls?.some(url => url.trim()) && !row.place_media.some(media => ['uploaded', 'ready'].includes(media.lifecycle_status))) {
      missingCover++; reasons.push('缺图片');
    }
    if (!row.address?.trim()) {missingAddress++; reasons.push('缺地址');}
    if (row.longitude === null || row.latitude === null || !Number.isFinite(row.longitude) || !Number.isFinite(row.latitude)) {
      missingCoordinates++; reasons.push('缺坐标');
    }
    if (reasons.length) issues.push({id: row.id, name: row.name, reasons});
  }
  return {total: rows.length, places: rows.map(row => ({id: row.id, name: row.name})), published: published.length, draft: rows.filter(row => row.status === 'draft').length,
    archived: rows.filter(row => row.status === 'archived').length, missingCover, missingAddress, missingCoordinates, issues};
}

export type DataBlock<T> = {data: T; loaded: number; total: number | null; incomplete: boolean; error: null}
  | {data: null; loaded: 0; total: null; incomplete: false; error: string};
export type AuditItem = {id: string; action: string; entity: string; target: string; actor: string; createdAt: string};
export type OperationsReport = {
  range: TrafficRange; updatedAt: number;
  traffic: DataBlock<ReturnType<typeof summarizeVisits>>;
  searches: DataBlock<ReturnType<typeof summarizeSearches>>;
  quality: DataBlock<ReturnType<typeof summarizeQuality>>;
  pendingReviews: DataBlock<number>;
  activity: DataBlock<AuditItem[]>;
};
