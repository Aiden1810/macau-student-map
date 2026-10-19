// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
const api = vi.hoisted(() => ({request: vi.fn()}));
vi.mock('../../../components/admin/PlaceEditor', () => ({adminEditorRequest: api.request}));
import ReviewInbox from '../../../components/admin/ReviewInbox';
const record = {
  id: 'r1',
  placeId: 'p1',
  placeName: '测试面店',
  userId: 'u1',
  rating: 2,
  content: '真实体验',
  status: 'published',
  moderationStatus: 'pending',
  moderationReason: null,
  deletedAt: null,
  createdAt: '2026-10-19T00:00:00Z',
  updatedAt: '2026-10-19T01:00:00.123456Z'
};
let host: HTMLDivElement;
let root: Root;
const button = (label: string) =>
  [...host.querySelectorAll('button')].find((item) => item.textContent === label)!;
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    }
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    }
  });
  vi.clearAllMocks();
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  api.request.mockResolvedValue({items: [record], total: 1, page: 0});
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
describe('administrator post-publication review inbox', () => {
  it('supports cancelling the confirmation with the native dialog escape event', async () => {
    await act(async () => root.render(<ReviewInbox />));
    await act(async () => button('隐藏评价').click());
    const dialog = host.querySelector('dialog');
    expect(dialog?.open).toBe(true);
    await act(async () => dialog!.dispatchEvent(new Event('cancel', {cancelable: true})));
    expect(host.querySelector('dialog')).toBeNull();
    expect(api.request).toHaveBeenCalledTimes(1);
  });
  it('shows published reviews waiting for moderation and does not mutate when opening the inbox', async () => {
    await act(async () => root.render(<ReviewInbox />));
    expect(host.textContent).toContain('测试面店');
    expect(host.textContent).toContain('真实体验');
    expect(host.textContent).toContain('已展示');
    expect(api.request).toHaveBeenCalledTimes(1);
  });
  it('requires a reason and confirmation before hiding; cancellation is read-only', async () => {
    await act(async () => root.render(<ReviewInbox />));
    await act(async () => button('隐藏评价').click());
    expect(button('确认隐藏').disabled).toBe(true);
    await act(async () => button('取消').click());
    expect(api.request).toHaveBeenCalledTimes(1);
    await act(async () => button('隐藏评价').click());
    const input = host.querySelector('textarea')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, '广告内容');
      input.dispatchEvent(new Event('input', {bubbles: true}));
    });
    expect(button('确认隐藏').disabled).toBe(false);
    await act(async () => button('确认隐藏').click());
    expect(api.request).toHaveBeenCalledWith(
      '/api/admin/reviews/r1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({decision: 'rejected', reason: '广告内容', expectedUpdatedAt: record.updatedAt})
      })
    );
  });
  it('shows deleted reviews as records and cannot restore them', async () => {
    api.request.mockResolvedValue({
      items: [{...record, deletedAt: '2026-10-19T02:00:00Z'}],
      total: 1,
      page: 0
    });
    await act(async () => root.render(<ReviewInbox />));
    expect(host.textContent).toContain('用户已删除');
    expect(button('审核通过')).toBeUndefined();
  });
});
