import {describe, expect, it} from 'vitest';
import {summarizeTraffic} from '../../../lib/admin/traffic';

const now = Date.parse('2026-01-02T04:30:00Z');
const event = (created_at: string, session_id: string | null = 'browser-a', path = '/zh-CN') => ({created_at, session_id, path});

describe('public traffic overview', () => {
  it('orders hours across midnight by time, not by the printed hour', () => {
    const result = summarizeTraffic([event('2026-01-01T15:30:00Z'), event('2026-01-01T16:30:00Z')], '24h', now);
    const active = result.timeline.filter(point => point.count);
    expect(active.map(point => point.label)).toEqual(['1/1 23:00', '1/2 00:00']);
  });
  it('keeps all 30 calendar days including empty days, across a year boundary', () => {
    const result = summarizeTraffic([event('2025-12-05T04:00:00Z'), event('2026-01-02T03:00:00Z')], '30d', now);
    expect(result.timeline).toHaveLength(30);
    expect(result.timeline[0].label).toBe('12/4');
    expect(result.timeline.at(-1)?.label).toBe('1/2');
    expect(result.timeline.reduce((sum, point) => sum + point.count, 0)).toBe(2);
  });
  it('excludes administrator and sign-in pages, invalid dates, future and old records', () => {
    const result = summarizeTraffic([
      event('2026-01-02T04:00:00Z'),
      event('2026-01-02T04:00:00Z', 'a', '/zh-CN/admin'),
      event('2026-01-02T04:00:00Z', 'a', '/en/admin/tools'),
      event('2026-01-02T04:00:00Z', 'a', '/zh-MO/admin-login'),
      event('2026-01-02T04:00:00Z', 'a', '/zh-CN/login'),
      event('invalid'), event('2026-01-03T00:00:00Z'), event('2025-01-01T00:00:00Z')
    ], '7d', now);
    expect(result.pv).toBe(1);
    expect(result.topPages).toEqual([{path: '/zh-CN', count: 1}]);
  });
  it('counts missing browser identifiers as page views, without inventing visitors', () => {
    const result = summarizeTraffic([
      event('2026-01-02T04:00:00Z'), event('2026-01-02T04:01:00Z'),
      event('2026-01-02T04:02:00Z', 'browser-b'), event('2026-01-02T04:03:00Z', null),
      event('2026-01-02T04:04:00Z', '   ')
    ], '24h', now);
    expect(result.pv).toBe(5);
    expect(result.uv).toBe(2);
    expect(result.identifiedViews).toBe(3);
  });
  it('has zero-height empty buckets and no imaginary peak when there are no visits', () => {
    const result = summarizeTraffic([], '7d', now);
    expect(result.timeline).toHaveLength(7);
    expect(result.timeline.every(point => point.count === 0)).toBe(true);
    expect(result.peakPoint).toBeNull();
    expect(result.pv).toBe(0);
  });
  it('includes the first calendar day from midnight in Macau, excludes the previous day', () => {
    const result = summarizeTraffic([
      event('2025-12-26T16:00:00Z'), event('2025-12-26T15:59:59Z')
    ], '7d', now);
    expect(result.pv).toBe(1);
  });
});
