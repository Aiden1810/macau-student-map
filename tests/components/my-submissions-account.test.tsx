// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const auth = vi.hoisted(() => ({getSession: vi.fn(), onAuthStateChange: vi.fn()}));
const translate = vi.hoisted(() => (key: string) => key);
vi.mock('next-intl', () => ({useLocale: () => 'zh-CN', useTranslations: () => translate}));
vi.mock('../../i18n/navigation', () => ({Link: ({children}: {children: React.ReactNode}) => <>{children}</>}));
vi.mock('../../lib/supabase', () => ({supabase: {auth}}));
vi.mock('../../lib/api/client', () => ({authenticatedApiRequest: vi.fn()}));

import MySubmissionsPage from '../../app/[locale]/my-submissions/page';
import {authenticatedApiRequest} from '../../lib/api/client';

let host: HTMLDivElement;
let root: Root;
const session = (id: string) => ({user: {id}, access_token: `${id}-token`});
const result = (id: string) => ({items: [{id, name: `${id}的投稿`, status: 'pending', categorySlug: 'food',
  createdAt: '2026-10-30T00:00:00Z', submittedAt: null, reviewNote: `${id}的审核备注`} ]});
const account = (id: string | null) => auth.onAuthStateChange.mock.calls[0]?.[0](
  id ? 'SIGNED_IN' : 'SIGNED_OUT', id ? session(id) : null
);
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  auth.getSession.mockResolvedValue({data: {session: session('alice')}, error: null});
  auth.onAuthStateChange.mockReturnValue({data: {subscription: {unsubscribe() {}}}});
  vi.mocked(authenticatedApiRequest).mockImplementation(async (_path, token) => result(token.startsWith('alice') ? 'alice' : 'bob'));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {await act(async () => root.unmount()); host.remove();});

describe('submission ownership across auth changes', () => {
  it('removes account records and review notes on sign-out from another tab', async () => {
    await act(async () => root.render(<MySubmissionsPage />));
    expect(host.textContent).toContain('alice的审核备注');
    await act(async () => account(null));
    expect(host.textContent).not.toContain('alice');
    expect(host.textContent).toContain('请先登录');
  });

  it('discards a previous account request after switching accounts', async () => {
    let finishAlice!: (value: ReturnType<typeof result>) => void;
    vi.mocked(authenticatedApiRequest).mockImplementation((_path, token) => token === 'alice-token'
      ? new Promise(resolve => {finishAlice = resolve;}) : Promise.resolve(result('bob')));
    await act(async () => root.render(<MySubmissionsPage />));
    await act(async () => account('bob'));
    await act(async () => finishAlice(result('alice')));
    expect(host.textContent).toContain('bob的投稿');
    expect(host.textContent).not.toContain('alice');
  });

  it('ignores a stale initial session lookup after a newer sign-in event', async () => {
    let finishSession!: (value: {data: {session: ReturnType<typeof session>}; error: null}) => void;
    auth.getSession.mockImplementation(() => new Promise(resolve => {finishSession = resolve;}));
    await act(async () => root.render(<MySubmissionsPage />));
    await act(async () => account('bob'));
    await act(async () => finishSession({data: {session: session('alice')}, error: null}));
    expect(host.textContent).toContain('bob的投稿');
    expect(host.textContent).not.toContain('alice');
  });
});
