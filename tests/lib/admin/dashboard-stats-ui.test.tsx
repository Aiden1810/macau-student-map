// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
const api = vi.hoisted(() => ({request: vi.fn()}));
vi.mock('../../../components/admin/PlaceEditor', () => ({
  adminEditorRequest: api.request,
}));
import UserGrowthPanel from '../../../components/admin/UserGrowthPanel';
import UsageDashboard from '../../../components/admin/UsageDashboard';
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const button = (label: string) =>
  [...host.querySelectorAll('button')].find((b) => b.textContent === label)!;
const registration = {
  range: '7d',
  rangeStart: 0,
  updatedAt: 1,
  total: 10,
  newUsers: 3,
  timeline: [{timestamp: 0, label: '10/22', count: 3}],
};
const usage = {
  range: '7d',
  rangeStart: 0,
  updatedAt: 1,
  collection: {enabled: true, startedAt: 1, lastEventAt: null},
  serverConfigured: true,
  retentionDays: 45,
  currency: 'USD',
  summary: [],
  breakdown: [],
  timeline: [{timestamp: 1, label: '10/22', http: 0, ai: 0}],
};
describe('admin growth and usage panels', () => {
  it('switches registration periods and ignores an old response', async () => {
    let finish: (value: unknown) => void = () => {};
    api.request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await act(async () => root.render(<UserGrowthPanel />));
    api.request.mockResolvedValueOnce({
      ...registration,
      range: '24h',
      newUsers: 8,
    });
    await act(async () => button('近 24 小时').click());
    await act(async () => finish(registration));
    expect(host.textContent).toContain('8');
    expect(host.textContent).toContain('滚动 24 小时');
    expect(api.request.mock.calls.at(-1)?.[0]).toBe(
      '/api/admin/users/stats?range=24h',
    );
  });
  it('clears previous growth counts after a failed refresh', async () => {
    api.request.mockResolvedValueOnce(registration);
    await act(async () => root.render(<UserGrowthPanel />));
    api.request.mockRejectedValueOnce(new Error('failed'));
    await act(async () => button('刷新统计').click());
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(
      host.querySelector('[aria-label="新增注册账号数"]')?.textContent,
    ).toBe('—');
  });
  it('does not present an unconfigured collector as zero cost or a healthy service', async () => {
    api.request.mockResolvedValueOnce({...usage, serverConfigured: false});
    await act(async () => root.render(<UsageDashboard />));
    expect(host.textContent).toContain('采集尚未启用');
    expect(host.textContent).toContain('暂无计价记录');
    expect(host.textContent).not.toContain('100%');
  });
  it('shows known tokens, unknown usage and estimated fee coverage separately', async () => {
    const row = {
      kind: 'ai',
      calls: 4,
      succeeded: 2,
      failed: 1,
      timeouts: 1,
      cancelled: 0,
      limited: 0,
      rejected: 0,
      unconfigured: 0,
      meanMs: 100,
      p95Ms: 200,
      inputTokens: 300,
      outputTokens: 40,
      unknownUsage: 1,
      pricedCalls: 2,
      costLow: 0.0001,
      costHigh: 0.0002,
    };
    api.request.mockResolvedValueOnce({...usage, summary: [row]});
    await act(async () => root.render(<UsageDashboard />));
    expect(host.textContent).toContain('300');
    expect(host.textContent).toContain('用量未知 1 次');
    expect(host.textContent).toContain('已计价 2 / 4 次');
    expect(host.textContent).toContain('USD');
    api.request.mockRejectedValueOnce(new Error('failed'));
    await act(async () => button('刷新统计').click());
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.textContent).not.toContain('已计价 2 / 4 次');
  });
});
