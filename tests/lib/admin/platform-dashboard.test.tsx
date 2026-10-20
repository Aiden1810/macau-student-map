// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
const api = vi.hoisted(() => ({request: vi.fn()}));
vi.mock('../../../components/admin/PlaceEditor', () => ({adminEditorRequest: api.request}));
import PlatformDashboard from '../../../components/admin/PlatformDashboard';
import {summarizeQuality, summarizeSearches, summarizeVisits} from '../../../lib/admin/operations';

const now = Date.parse('2026-10-20T04:00:00Z');
const block = <T,>(data: T) => ({data, error: null, loaded: 1, total: 1, incomplete: false});
const report = () => ({range: '7d' as const, updatedAt: now,
  traffic: block(summarizeVisits([], '7d', now)), searches: block(summarizeSearches([])),
  quality: block(summarizeQuality([{id: 'p1', name: '测试店', status: 'published', address: null, longitude: null, latitude: null, place_media: []}])),
  pendingReviews: {data: null, loaded: 0 as const, total: null, incomplete: false as const, error: '评价审核尚未启用'},
  activity: block([])
});
let host: HTMLDivElement;
let root: Root;
const props = {section: 'overview' as const, places: null, queue: {pending: 3, approved: 0, rejected: 0, merged: 0}, feedback: null,
  onChange: vi.fn(), onQuality: vi.fn(), onEditPlace: vi.fn()};
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  api.request.mockResolvedValue(report());
});
afterEach(async () => {await act(async () => root.unmount()); host.remove();});
const button = (label: string) => [...host.querySelectorAll('button')].find(item => item.textContent?.includes(label))!;

describe('platform dashboard actions and report states', () => {
  it('opens the relevant quality filter and keeps unavailable review counts distinct from zero', async () => {
    await act(async () => root.render(<PlatformDashboard {...props} />));
    expect(host.textContent).toContain('评价审核尚未启用');
    await act(async () => button('缺图片').click());
    expect(props.onQuality).toHaveBeenCalledWith('cover');
    await act(async () => button('待审核投稿').click());
    expect(props.onChange).toHaveBeenCalledWith('submissions');
  });
  it('does not show empty statistics or stale totals after a failed refresh', async () => {
    await act(async () => root.render(<PlatformDashboard {...props} />));
    api.request.mockRejectedValueOnce(new Error('network'));
    await act(async () => button('刷新工作台').click());
    expect(host.textContent).toContain('工作台读取失败');
    expect(host.textContent).not.toContain('浏览趋势');
  });
  it('ignores an old range response that arrives after the new selection', async () => {
    let finishOld: (value: unknown) => void = () => {};
    api.request.mockImplementationOnce(() => new Promise(resolve => {finishOld = resolve;}));
    await act(async () => root.render(<PlatformDashboard {...props} />));
    const next = report(); next.traffic.data.summary.pv = 9;
    api.request.mockResolvedValueOnce({...next, range: '30d'});
    await act(async () => button('30 天').click());
    await act(async () => finishOld(report()));
    expect(host.textContent).toContain('最近 30 个自然日');
    expect(host.textContent).not.toContain('正在读取工作台');
  });
});
