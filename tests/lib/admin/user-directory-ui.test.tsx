// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
const api = vi.hoisted(() => ({request: vi.fn(), submissions: vi.fn()}));
vi.mock('../../../components/admin/PlaceEditor', () => ({adminEditorRequest: api.request, default: () => null}));
vi.mock('../../../components/admin/UserGrowthPanel', () => ({default: () => null}));
vi.mock('../../../lib/supabase', () => ({supabase: {auth: {getSession: async () => ({data: {session: {access_token: 'test'}}})}}}));
vi.mock('../../../lib/api/client', () => ({authenticatedApiRequest: api.submissions}));
import UsersManager from '../../../components/admin/UsersManager';
import PlacesManager from '../../../components/admin/PlacesManager';
import SubmissionQueue from '../../../components/admin/SubmissionQueue';

let host: HTMLDivElement;
let root: Root;
const directory = {total: 26, matched: 26, page: 1, pageSize: 25,
  items: [{id: 'u1', email: 'student@example.test', createdAt: '2026-10-21T01:00:00Z', role: 'member'}]};
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  api.request.mockResolvedValue(directory);
});
afterEach(async () => {await act(async () => root.unmount()); host.remove();});
const button = (label: string) => [...host.querySelectorAll('button')].find(item => item.textContent?.includes(label))!;
const inputText = async (input: HTMLInputElement, value: string) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', {bubbles: true}));
});
describe('registered account management', () => {
  it('shows the true registration count and requests a new page instead of loading all users', async () => {
    await act(async () => root.render(<UsersManager />));
    expect(host.textContent).toContain('注册账号总数');
    expect(host.textContent).toContain('26');
    expect(host.textContent).toContain('student@example.test');
    api.request.mockResolvedValueOnce({...directory, page: 2, items: [{...directory.items[0], email: null}]});
    await act(async () => button('下一页').click());
    expect(api.request.mock.calls.at(-1)?.[0]).toBe('/api/admin/users?page=2&q=');
    expect(host.textContent).toContain('未绑定邮箱');
    expect(button('下一页').disabled).toBe(true);
  });
  it('resets to the first page when searching and encodes literal input', async () => {
    await act(async () => root.render(<UsersManager />));
    await inputText(host.querySelector('input')!, 'student+%');
    api.request.mockResolvedValueOnce({...directory, matched: 0, items: []});
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true})));
    expect(api.request.mock.calls.at(-1)?.[0]).toBe('/api/admin/users?page=1&q=student%2B%25');
    expect(host.textContent).toContain('没有符合条件的账号');
  });
  it('hides stale emails and totals after an unsuccessful refresh, then permits retry', async () => {
    await act(async () => root.render(<UsersManager />));
    api.request.mockRejectedValueOnce(new Error('读取失败'));
    await act(async () => button('刷新').click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('读取失败');
    expect(host.textContent).not.toContain('student@example.test');
    expect(host.querySelector('tbody')).toBeNull();
    api.request.mockResolvedValueOnce(directory);
    await act(async () => button('刷新').click());
    expect(host.textContent).toContain('student@example.test');
  });
  it('ignores an older response after a new search', async () => {
    let resolveOld: (value: unknown) => void = () => {};
    api.request.mockImplementationOnce(() => new Promise(resolve => {resolveOld = resolve;}));
    await act(async () => root.render(<UsersManager />));
    await inputText(host.querySelector('input')!, 'new');
    api.request.mockResolvedValueOnce({...directory, items: [{...directory.items[0], email: 'new@example.test'}]});
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true})));
    await act(async () => resolveOld(directory));
    expect(host.textContent).toContain('new@example.test');
    expect(host.textContent).not.toContain('student@example.test');
  });
});
describe('shop and submission attribution in the existing lists', () => {
  it('shows the stored account email and explicitly marks unknown historical sources', async () => {
    const place = {id: 'p1', name: '测试店', nameEn: null, address: null, status: 'draft', categorySlug: 'food',
      region: null, longitude: null, latitude: null, pricePerPerson: null, tagIds: [], searchKeywords: [], media: [], updatedAt: '2026-10-21'};
    api.request.mockResolvedValueOnce({items: [
      {...place, createdBy: {id: 'u1', email: 'student@example.test'}},
      {...place, id: 'p2', name: '旧资料', createdBy: null},
      {...place, id: 'p3', createdBy: {id: 'removed-user', email: null}}
    ]});
    await act(async () => root.render(<PlacesManager createOpen={false} onCreateClose={() => {}} refreshSignal={0} />));
    const rows = host.querySelectorAll('article');
    expect(rows[0].textContent).toContain('student@example.test');
    expect(rows[1].textContent).toContain('来源未记录');
    expect(rows[2].textContent).toContain('邮箱不可用');
    expect(rows[2].textContent).toContain('removed-user');
  });
  it('shows the submitter email in the moderation queue', async () => {
    api.submissions.mockResolvedValueOnce({items: [{id: 's1', name: '投稿店铺', address: null, categorySlug: 'food', tagIds: [],
      submittedAt: '2026-10-21', submitter: {id: 'u1', email: 'student@example.test'}}], stats: {pending: 1, approved: 0, merged: 0, rejected: 0}});
    await act(async () => root.render(<SubmissionQueue />));
    expect(host.querySelector('article')?.textContent).toContain('投稿账号：student@example.test');
  });
});
