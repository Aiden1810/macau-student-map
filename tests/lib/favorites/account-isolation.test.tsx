// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const auth = vi.hoisted(() => ({getUser: vi.fn(), onAuthStateChange: vi.fn()}));
const database = vi.hoisted(() => ({read: vi.fn(), write: vi.fn(), remove: vi.fn()}));
const toast = vi.hoisted(() => ({loading: vi.fn(), success: vi.fn(), error: vi.fn(), dismiss: vi.fn()}));
const translate = vi.hoisted(() => (key: string) => key);
vi.mock('next-intl', () => ({useTranslations: () => translate}));
vi.mock('react-hot-toast', () => ({default: toast}));
vi.mock('../../../lib/supabase', () => ({supabase: {auth,
  from: () => ({
    select: () => ({eq: (_field: string, id: string) => ({abortSignal: () => database.read(id)})}),
    upsert: (rows: unknown) => ({abortSignal: () => database.write(rows)}),
    delete: () => ({eq: (_field: string, userId: string) => ({eq: (_shop: string, shopId: string) => ({
      abortSignal: () => database.remove(userId, shopId)
    })})})
  })
}}));
import {useFavorites} from '../../../lib/hooks/useFavorites';
import {FAVORITES_KEY, LEGACY_FAVORITES_KEY, favoriteStorageKey, pendingFavoritesKey} from '../../../lib/favorites/storage';

let host: HTMLDivElement;
let root: Root;
let value: ReturnType<typeof useFavorites>;
const account = (id: string | null) => auth.onAuthStateChange.mock.calls[0][0](
  id ? 'SIGNED_IN' : 'SIGNED_OUT', id ? {user: {id}} : null
);
const rows = (...ids: string[]) => ({data: ids.map(shop_id => ({shop_id})), error: null});
function Harness() {value = useFavorites(); return null;}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  auth.getUser.mockResolvedValue({data: {user: {id: 'alice'}}, error: null});
  auth.onAuthStateChange.mockReturnValue({data: {subscription: {unsubscribe() {}}}});
  database.read.mockImplementation(async id => rows(`${id}-favorite`));
  database.write.mockResolvedValue({error: null});
  database.remove.mockResolvedValue({error: null});
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.useRealTimers();
});

describe('favorite ownership across auth changes', () => {
  it('never imports the unowned old cache or another account cache', async () => {
    localStorage.setItem(LEGACY_FAVORITES_KEY, JSON.stringify(['unknown-owner']));
    await act(async () => root.render(<Harness />));
    expect(value.favorites).toEqual(['alice-favorite']);
    await act(async () => account('bob'));
    expect(value.favorites).toEqual(['bob-favorite']);
    expect(database.write).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(favoriteStorageKey('alice'))!)).toEqual(['alice-favorite']);
    expect(JSON.parse(localStorage.getItem(LEGACY_FAVORITES_KEY)!)).toEqual(['unknown-owner']);
    await act(async () => account(null));
    expect(value.favorites).toEqual([]);
  });
  it('treats the remote list as authoritative instead of resurrecting deleted favorites from a cache', async () => {
    localStorage.setItem(favoriteStorageKey('alice'), JSON.stringify(['removed-on-another-device']));
    database.read.mockResolvedValue(rows());
    await act(async () => root.render(<Harness />));
    expect(value.favorites).toEqual([]);
    expect(database.write).not.toHaveBeenCalled();
  });
  it('claims guest saves for one account even when auth changes before its read finishes', async () => {
    let finish!: (result: ReturnType<typeof rows>) => void;
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(['guest-favorite']));
    database.read.mockImplementation(id => id === 'alice'
      ? new Promise(resolve => {finish = resolve;}) : Promise.resolve(rows('bob-favorite')));
    await act(async () => root.render(<Harness />));
    expect(JSON.parse(localStorage.getItem(pendingFavoritesKey('alice'))!)).toEqual(['guest-favorite']);
    await act(async () => account('bob'));
    await act(async () => finish(rows('alice-favorite')));
    expect(value.favorites).toEqual(['bob-favorite']);
    expect(database.write).not.toHaveBeenCalled();
    database.read.mockResolvedValue(rows('alice-favorite'));
    await act(async () => account('alice'));
    expect(database.write).toHaveBeenCalledExactlyOnceWith([{user_id: 'alice', shop_id: 'guest-favorite'}]);
    expect(value.favorites).toEqual(['alice-favorite', 'guest-favorite']);
    expect(JSON.parse(localStorage.getItem(pendingFavoritesKey('alice'))!)).toEqual([]);
  });
  it('retains a failed guest import only for its owner and retries it after signing back in', async () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(['guest-favorite']));
    database.write.mockResolvedValueOnce({error: {message: 'offline'}});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await act(async () => root.render(<Harness />));
    expect(value.favorites).toEqual(['alice-favorite']);
    expect(JSON.parse(localStorage.getItem(pendingFavoritesKey('alice'))!)).toEqual(['guest-favorite']);
    await act(async () => account('bob'));
    expect(database.write).toHaveBeenCalledTimes(1);
    await act(async () => account('alice'));
    expect(value.favorites).toContain('guest-favorite');
    expect(database.write).toHaveBeenCalledTimes(2);
  });
  it('ignores a stale initial auth lookup after a newer session event', async () => {
    let finish!: (result: unknown) => void;
    auth.getUser.mockImplementation(() => new Promise(resolve => {finish = resolve;}));
    await act(async () => root.render(<Harness />));
    expect(value.isLoaded).toBe(false);
    await act(async () => account('bob'));
    await act(async () => finish({data: {user: {id: 'alice'}}, error: null}));
    expect(value.favorites).toEqual(['bob-favorite']);
    expect(database.read).not.toHaveBeenCalledWith('alice');
  });
  it('does not retry a failed guest import after the user manually saves and removes that favorite', async () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(['guest-favorite']));
    database.write.mockResolvedValueOnce({error: {message: 'offline'}});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await act(async () => root.render(<Harness />));
    await act(async () => value.toggleFavorite('guest-favorite'));
    await act(async () => value.toggleFavorite('guest-favorite'));
    expect(JSON.parse(localStorage.getItem(pendingFavoritesKey('alice'))!)).toEqual([]);
    await act(async () => account(null));
    await act(async () => account('alice'));
    expect(database.write).toHaveBeenCalledTimes(2);
    expect(value.favorites).not.toContain('guest-favorite');
  });
  it('discards an old save completion even after switching away and back to the same account', async () => {
    let finish!: (result: {error: null}) => void;
    database.write.mockImplementation(() => new Promise(resolve => {finish = resolve;}));
    await act(async () => root.render(<Harness />));
    let save!: Promise<void>;
    await act(async () => {save = value.toggleFavorite('late-save');});
    await act(async () => account('bob'));
    await act(async () => account('alice'));
    await act(async () => {finish({error: null}); await save;});
    expect(value.favorites).toEqual(['alice-favorite']);
    expect(toast.success).not.toHaveBeenCalled();
  });
  it('writes guest changes locally and account changes only to that account cache', async () => {
    auth.getUser.mockResolvedValue({data: {user: null}, error: null});
    await act(async () => root.render(<Harness />));
    await act(async () => value.toggleFavorite('guest-save'));
    expect(JSON.parse(localStorage.getItem(FAVORITES_KEY)!)).toEqual(['guest-save']);
    expect(database.write).not.toHaveBeenCalled();
    await act(async () => account('alice'));
    await act(async () => value.toggleFavorite('account-save'));
    expect(JSON.parse(localStorage.getItem(favoriteStorageKey('alice'))!)).toContain('account-save');
    expect(JSON.parse(localStorage.getItem(FAVORITES_KEY)!)).toEqual([]);
    await act(async () => account(null));
    expect(value.favorites).toEqual([]);
  });
  it('does not reload or overwrite favorites when the same session refreshes its token', async () => {
    await act(async () => root.render(<Harness />));
    await act(async () => account('alice'));
    expect(database.read).toHaveBeenCalledTimes(1);
  });
  it('releases loading on timeout and ignores a late remote response', async () => {
    vi.useFakeTimers();
    let finish!: (result: ReturnType<typeof rows>) => void;
    database.read.mockImplementation(() => new Promise(resolve => {finish = resolve;}));
    await act(async () => root.render(<Harness />));
    expect(value.isLoaded).toBe(false);
    await act(async () => vi.advanceTimersByTime(10000));
    expect(value.isLoaded).toBe(true);
    await act(async () => finish(rows('too-late')));
    expect(value.favorites).toEqual([]);
  });
});
