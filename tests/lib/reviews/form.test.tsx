// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const auth = vi.hoisted(() => ({getSession: vi.fn(), onAuthStateChange: vi.fn()}));
const api = vi.hoisted(() => ({request: vi.fn()}));
vi.mock('../../../lib/supabase', () => ({supabase: {auth}}));
vi.mock('../../../lib/api/client', async () => ({
  ...(await vi.importActual('../../../lib/api/client')),
  authenticatedApiRequest: api.request
}));
vi.mock('next-intl', () => ({useLocale: () => 'zh-CN'}));
import ReviewForm from '../../../components/reviews/ReviewForm';

const record = {
  id: 'review-1',
  placeId: 'place-1',
  userId: 'user-1',
  rating: 3,
  content: '原来的评价',
  status: 'published',
  moderationStatus: 'pending',
  moderationReason: null,
  deletedAt: null,
  createdAt: '2026-10-19T00:00:00Z',
  updatedAt: '2026-10-19T01:00:00.123456Z'
};
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
      // Native showModal focuses the first eligible control after React mounts.
      this.querySelector<HTMLElement>('button:not([disabled]), textarea:not([disabled])')?.focus();
    }
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    }
  });
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  auth.getSession.mockResolvedValue({data: {session: {access_token: 'test', user: {id: 'user-1'}}}});
  auth.onAuthStateChange.mockReturnValue({data: {subscription: {unsubscribe: vi.fn()}}});
  api.request.mockResolvedValue({review: record});
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const button = (label: string) =>
  [...host.querySelectorAll('button')].find((item) => item.textContent === label)!;
describe('my review interactions', () => {
  it('does not restore a saved notice when an old account refresh fails after sign-out', async () => {
    let rejectRefresh!: (reason: Error) => void;
    const onSuccess = () =>
      new Promise<void>((_resolve, reject) => {
        rejectRefresh = reject;
      });
    await act(async () => root.render(<ReviewForm placeId="place-1" onSuccess={onSuccess} />));
    await act(async () => button('修改评价').click());
    api.request.mockResolvedValue(record);
    await act(async () => button('保存修改').click());
    await act(async () => auth.onAuthStateChange.mock.calls[0][0]('SIGNED_OUT', null));
    await act(async () => rejectRefresh(new Error('Old page refresh failed')));
    expect(host.textContent).not.toContain('评价已保存');
    expect(host.textContent).toContain('登录后即可评分');
  });
  it('refreshes the surrounding scores after recovering from an unknown save result', async () => {
    const onSuccess = vi.fn();
    const onRefresh = vi.fn();
    await act(async () =>
      root.render(<ReviewForm placeId="place-1" onSuccess={onSuccess} onRefresh={onRefresh} />)
    );
    await act(async () => button('修改评价').click());
    api.request.mockRejectedValueOnce(new TypeError('Response lost after commit'));
    await act(async () => button('保存修改').click());
    expect(button('保存修改').disabled).toBe(true);
    api.request.mockResolvedValue({review: {...record, rating: 5}});
    await act(async () => button('刷新我的评价').click());
    expect(host.textContent).toContain('5 星');
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onSuccess).not.toHaveBeenCalled();
  });
  it('clears a previous account success notice after signing out', async () => {
    await act(async () => root.render(<ReviewForm placeId="place-1" />));
    await act(async () => button('修改评价').click());
    api.request.mockResolvedValue(record);
    await act(async () => button('保存修改').click());
    expect(host.textContent).toContain('评价已保存');
    await act(async () => auth.onAuthStateChange.mock.calls[0][0]('SIGNED_OUT', null));
    expect(host.textContent).not.toContain('评价已保存');
    expect(host.textContent).toContain('登录后即可评分');
  });
  it('preserves an unsaved draft when the session token refreshes', async () => {
    await act(async () => root.render(<ReviewForm placeId="place-1" />));
    await act(async () => button('修改评价').click());
    const input = host.querySelector('textarea')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
        input,
        '尚未提交的新体验'
      );
      input.dispatchEvent(new Event('input', {bubbles: true}));
    });
    await act(async () =>
      auth.onAuthStateChange.mock.calls[0][0]('TOKEN_REFRESHED', {
        access_token: 'refreshed',
        user: {id: 'user-1'}
      })
    );
    expect(host.querySelector('textarea')?.value).toBe('尚未提交的新体验');
    expect(api.request).toHaveBeenCalledTimes(1);
    api.request.mockResolvedValue(record);
    await act(async () => button('保存修改').click());
    expect(api.request).toHaveBeenLastCalledWith(
      '/api/places/place-1/reviews',
      'refreshed',
      expect.anything()
    );
  });
  it('shows login before accepting a draft when signed out', async () => {
    auth.getSession.mockResolvedValue({data: {session: null}});
    await act(async () => root.render(<ReviewForm placeId="place-1" />));
    expect(host.querySelector('textarea')).toBeNull();
    expect(host.querySelector('a')?.href).toContain('/zh-CN/login?next=');
    expect(api.request).not.toHaveBeenCalled();
  });
  it('loads my existing rating and text before editing and sends its exact version', async () => {
    const onSuccess = vi.fn();
    await act(async () => root.render(<ReviewForm placeId="place-1" onSuccess={onSuccess} />));
    expect(host.textContent).toContain('我的评价');
    expect(host.textContent).toContain('原来的评价');
    await act(async () => button('修改评价').click());
    expect(host.querySelector('textarea')?.value).toBe('原来的评价');
    expect(host.querySelector('[aria-label="3 星"]')?.getAttribute('aria-checked')).toBe('true');
    api.request.mockResolvedValue(record);
    await act(async () => button('保存修改').click());
    expect(api.request).toHaveBeenLastCalledWith(
      '/api/places/place-1/reviews',
      'test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({rating: 3, content: '原来的评价', expectedUpdatedAt: record.updatedAt})
      })
    );
    expect(onSuccess).toHaveBeenCalledOnce();
  });
  it('requires delete confirmation; cancelling does not send a write', async () => {
    await act(async () => root.render(<ReviewForm placeId="place-1" />));
    await act(async () => button('删除评价').click());
    expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(document.activeElement?.textContent).toBe('取消');
    await act(async () => button('取消').click());
    expect(api.request).toHaveBeenCalledTimes(1);
    await act(async () => button('删除评价').click());
    api.request.mockResolvedValue({...record, deletedAt: '2026-10-19T02:00:00Z'});
    await act(async () => button('确认删除').click());
    expect(api.request).toHaveBeenLastCalledWith(
      '/api/reviews/review-1',
      'test',
      expect.objectContaining({method: 'DELETE'})
    );
    expect(host.textContent).not.toContain('原来的评价');
  });
  it('explains that editing a hidden review cannot immediately restore visibility', async () => {
    api.request.mockResolvedValue({
      review: {...record, status: 'rejected', moderationStatus: 'rejected', moderationReason: '含广告内容'}
    });
    await act(async () => root.render(<ReviewForm placeId="place-1" />));
    expect(host.textContent).toContain('已隐藏');
    expect(host.textContent).toContain('含广告内容');
    expect(host.textContent).toContain('重新审核');
  });
  it('does not call a successful save a failure when refreshing the list fails', async () => {
    await act(async () =>
      root.render(
        <ReviewForm
          placeId="place-1"
          onSuccess={async () => {
            throw new Error('refresh failed');
          }}
        />
      )
    );
    await act(async () => button('修改评价').click());
    api.request.mockResolvedValue(record);
    await act(async () => button('保存修改').click());
    expect(host.textContent).toContain('已保存');
    expect(host.textContent).toContain('刷新');
  });
});
