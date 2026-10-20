import {describe, expect, it} from 'vitest';
import {summarizeVisits, summarizeSearches, summarizeQuality, shouldTrackVisit} from '../../../lib/admin/operations';

const now = Date.parse('2026-10-20T04:00:00Z');
const visit = (path: string, session_id = 'a', extra = {}) => ({
  id: 'v1', created_at: '2026-10-20T03:00:00Z', path, session_id,
  user_agent: 'Mozilla/5.0 (iPhone) Mobile Safari/604.1', referrer: null, user_id: null, ...extra
});

describe('platform operations statistics', () => {
  it('keeps devices and sources within the same public time window, without leaking identifiers or source queries', () => {
    const result = summarizeVisits([
      visit('/zh-CN/shop/place-1'),
      visit('/en/shop/place-1', 'b', {referrer: 'https://example.com/link?token=secret', user_id: 'private-user'}),
      visit('/zh-CN/admin', 'c'),
      visit('/zh-CN', 'd', {created_at: '2026-10-21T00:00:00Z'})
    ], '7d', now);
    expect(result.summary.pv).toBe(2);
    expect(result.summary.uv).toBe(2);
    expect(result.devices).toEqual([{label: '手机', count: 2}]);
    expect(result.sources).toContainEqual({label: 'example.com', count: 1});
    expect(result.placeViews).toEqual([{id: 'place-1', count: 2}]);
    expect(result.recent).toHaveLength(2);
    expect(JSON.stringify(result)).not.toMatch(/private-user|secret|Mobile Safari/);
  });

  it('recognizes tablets and automation, while unknown user agents remain unknown', () => {
    const result = summarizeVisits([
      visit('/zh-CN', 'a', {user_agent: 'Mozilla/5.0 (iPad) Mobile Safari'}),
      visit('/zh-CN', 'b', {user_agent: 'HeadlessChrome/120'}),
      visit('/zh-CN', 'c', {user_agent: null, referrer: 'javascript:secret'})
    ], '7d', now);
    expect(result.devices).toContainEqual({label: '平板', count: 1});
    expect(result.devices).toContainEqual({label: '疑似自动化', count: 1});
    expect(result.devices).toContainEqual({label: '未知', count: 1});
    expect(result.sources).toContainEqual({label: '来源未知', count: 1});
  });

  it('does not infer an actual local origin just because a referrer is local', () => {
    const result = summarizeVisits([visit('/zh-CN', 'a', {referrer: 'http://localhost:56544/page'})], '7d', now);
    expect(result.localReferrerViews).toBe(1);
    expect(result.summary.pv).toBe(1);
    expect(result.sources).toEqual([{label: '本机来源（不代表访问环境）', count: 1}]);
  });

  it('groups repeated normalized keywords and treats filter-only searches separately', () => {
    const result = summarizeSearches([
      {query: '咖啡', normalized_query: '咖啡', result_count: 3},
      {query: ' 咖啡 ', normalized_query: '咖啡', result_count: 0},
      {query: '面', normalized_query: '面', result_count: 0},
      {query: '', normalized_query: '', result_count: 0}
    ]);
    expect(result.total).toBe(4);
    expect(result.missed).toBe(3);
    expect(result.filterOnly).toBe(1);
    expect(result.popular[0]).toEqual({label: '咖啡', count: 2});
    expect(result.missing).toEqual([{label: '咖啡', count: 1}, {label: '面', count: 1}]);
  });

  it('checks published canonical places, accepting legacy covers and ignoring failed media', () => {
    const result = summarizeQuality([
      {id: 'p1', name: '甲', status: 'published', address: ' ', longitude: 113.5, latitude: 22.1, legacy_image_urls: [], place_media: [{lifecycle_status: 'cleanup_pending'}]},
      {id: 'p2', name: '乙', status: 'published', address: '澳门', longitude: null, latitude: null, legacy_image_urls: ['https://example.com/a.jpg'], place_media: []},
      {id: 'p3', name: '草稿', status: 'draft', address: null, longitude: null, latitude: null, place_media: []}
    ]);
    expect(result.published).toBe(2);
    expect(result.missingCover).toBe(1);
    expect(result.missingAddress).toBe(1);
    expect(result.missingCoordinates).toBe(1);
    expect(result.issues.map(row => row.id)).toEqual(['p1', 'p2']);
  });

  it.each(['localhost', '127.0.0.1', '[::1]', 'demo.local', '192.168.1.2', '10.0.0.8', '172.16.0.1'])('does not record local or LAN visits from %s', hostname => {
    expect(shouldTrackVisit(hostname, '/zh-CN', 'production')).toBe(false);
  });
  it('does not record development, admin or sign-in visits but permits production public visits', () => {
    expect(shouldTrackVisit('chengmi.example', '/zh-CN', 'development')).toBe(false);
    expect(shouldTrackVisit('chengmi.example', '/en/admin', 'production')).toBe(false);
    expect(shouldTrackVisit('chengmi.example', '/zh-CN/login', 'production')).toBe(false);
    expect(shouldTrackVisit('chengmi.example', '/zh-CN', 'production')).toBe(true);
  });
});
