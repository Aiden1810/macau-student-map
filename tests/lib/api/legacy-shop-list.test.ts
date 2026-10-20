import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';

const state = vi.hoisted(() => ({cache: new Map<string, unknown>()}));
vi.mock('next/cache', () => ({
  unstable_cache: (load: () => Promise<unknown>, keys: string[]) => async () => {
    const key = keys.join('|');
    if (!state.cache.has(key)) state.cache.set(key, await load());
    return state.cache.get(key);
  },
  revalidateTag: () => state.cache.clear()
}));

import {GET} from '../../../app/api/shops/route';
import {loadLegacyShopList, notifyShopListChanged} from '../../../lib/data/legacy-shops';
import {createShopCacheRefreshRoute} from '../../../lib/api/shop-cache-refresh';

const admin = {ok: true as const, user: {id: 'admin'}, role: 'admin' as const, accessToken: 'admin-token'};
let calls: Array<{url: URL; headers: Headers}>;
let fail: boolean;
let publicName: string;
beforeEach(() => {
  state.cache.clear(); calls = []; fail = false; publicName = '公开店铺';
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://legacy-fixture.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-key');
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const headers = new Headers(init?.headers); calls.push({url, headers});
    if (url.pathname === '/api/shops') return GET();
    if (url.pathname === '/api/admin/shops/refresh-cache') return Response.json({ok: !fail, data: {refreshed: true}}, {status: fail ? 503 : 200});
    expect(url.pathname).toBe('/rest/v1/shops');
    const privileged = headers.get('authorization') === 'Bearer admin-token';
    return Response.json(fail ? {code: 'XX000', message: 'database private detail'} : privileged
      ? [{id: 'draft', name: '待审核资料', status: 'pending'}]
      : [{id: 'public', name: publicName, status: 'verified', name_i18n: {en: 'Public shop'}}], {status: fail ? 500 : 200});
  }));
});
afterEach(() => {vi.unstubAllEnvs(); vi.unstubAllGlobals();});

describe('legacy shop read boundary', () => {
  it('shares only anonymous verified rows, preserves translation data, and leaves responses uncached', async () => {
    const first = await GET();
    expect(first.headers.get('cache-control')).toBe('no-store');
    expect((await first.json()).data.items[0].name_i18n.en).toBe('Public shop');
    publicName = '更新店名';
    expect((await (await GET()).json()).data.items[0].name).toBe('公开店铺');
    expect(calls).toHaveLength(1);
    expect(calls[0].url.searchParams.get('status')).toBe('eq.verified');
    expect(calls[0].headers.get('authorization')).toBe('Bearer public-key');
  });
  it('does not store failed queries and recovers without waiting for expiry', async () => {
    fail = true;
    expect((await GET()).status).toBe(500);
    fail = false;
    expect((await (await GET()).json()).data.items[0].name).toBe('公开店铺');
    expect(calls).toHaveLength(2);
  });
  it('uses the public endpoint for visitors and keeps administrator reads outside shared cache', async () => {
    const client = createClient('https://legacy-fixture.supabase.co', 'public-key', {
      auth: {persistSession: false}, global: {headers: {authorization: 'Bearer admin-token'}}
    });
    expect((await loadLegacyShopList(client, false)).data?.[0]).toMatchObject({status: 'verified'});
    expect((await loadLegacyShopList(client, true)).data?.[0]).toMatchObject({status: 'pending'});
    expect((await loadLegacyShopList(client, false)).data?.[0]).toMatchObject({status: 'verified'});
    expect(calls.filter(call => call.url.pathname === '/rest/v1/shops')).toHaveLength(2);
  });
  it('clears the warmed list only after server administrator authorization', async () => {
    await GET(); publicName = '管理员修改';
    const denied = createShopCacheRefreshRoute({authorize: async () => ({ok: false as const,
      error: {code: 'FORBIDDEN' as const, status: 403, message: 'denied'}}), client: () => ({}) as SupabaseClient});
    const request = new Request('http://localhost/api/admin/shops/refresh-cache', {method: 'POST'});
    expect((await denied(request, {params: Promise.resolve({})})).status).toBe(403);
    expect((await (await GET()).json()).data.items[0].name).toBe('公开店铺');
    const allowed = createShopCacheRefreshRoute({authorize: async () => admin, client: () => ({}) as SupabaseClient});
    const response = await allowed(request, {params: Promise.resolve({})});
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect((await (await GET()).json()).data.items[0].name).toBe('管理员修改');
  });
  it('sends an authenticated refresh after browser writes without turning a saved write into a failure', async () => {
    const client = {auth: {getSession: async () => ({data: {session: {access_token: 'admin-token'}}})}} as unknown as SupabaseClient;
    await notifyShopListChanged(client);
    expect(calls[0].url.pathname).toBe('/api/admin/shops/refresh-cache');
    expect(calls[0].headers.get('authorization')).toBe('Bearer admin-token');
    fail = true;
    await expect(notifyShopListChanged(client)).resolves.toBeUndefined();
  });
});
