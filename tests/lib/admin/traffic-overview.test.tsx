import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import TrafficOverview from '../../../components/admin/TrafficOverview';
import {summarizeTraffic} from '../../../lib/admin/traffic';

const props = {
  summary: summarizeTraffic([], '7d', Date.parse('2026-10-18T12:00:00Z')),
  range: '7d' as const, onRangeChange: () => {}, onRefresh: () => {}, refreshing: false,
  error: null, loadedCount: 0, totalCount: 0, updatedAt: 0
};

describe('traffic overview data states', () => {
  it('shows unavailable metrics and no chart when reading fails', () => {
    const html = renderToStaticMarkup(<TrafficOverview {...props} error="network error" />);
    expect(html).toContain('访问数据暂不可用');
    expect(html).not.toContain('浏览趋势');
    expect(html).not.toContain('所选时间内没有');
  });
  it('distinguishes a successful empty period from a failure', () => {
    const html = renderToStaticMarkup(<TrafficOverview {...props} />);
    expect(html).toContain('所选时间内没有已记录的前台访问');
    expect(html).not.toContain('访问数据暂不可用');
  });
  it('discloses a truncated query instead of presenting it as a complete total', () => {
    const html = renderToStaticMarkup(<TrafficOverview {...props} loadedCount={1000} totalCount={1200} />);
    expect(html).toContain('当前仅加载最近 1,000 条浏览记录');
    expect(html).toContain('不能当作完整期间总量');
  });
});
