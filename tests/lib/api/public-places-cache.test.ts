import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

// Replace only the framework cache boundary; database access uses the real Supabase client.
const cache = vi.hoisted(() => ({entries: new Map<string, unknown>(), tags: [] as string[]}));
vi.mock('next/cache', () => ({
  unstable_cache: (load: () => Promise<unknown>, keys: string[], options: {tags: string[]; revalidate: number}) => async () => {
    const key = keys.join('|');
    cache.tags = options.tags;
    if (!cache.entries.has(key)) cache.entries.set(key, await load());
    return cache.entries.get(key);
  },
  revalidateTag: (tag: string) => {if (cache.tags.includes(tag)) cache.entries.clear();}
}));

import {GET} from '../../../app/api/places/route';
import {createAdminPlaceRoute} from '../../../lib/admin/api';
import {createReviewHandlers} from '../../../lib/reviews/handlers';
import type {SupabaseClient} from '@supabase/supabase-js';

const id = '11111111-1111-4111-8111-111111111111';
const auth = {ok: true as const, user: {id}, role: 'admin' as const, accessToken: 'user-token'};
const row = {id, name: '原店名', category_slug: 'food', address: '', region: null,
  longitude: 113.5, latitude: 22.1, price_per_person: 30, rating_average: null, review_count: 0,
  status: 'published', legacy_image_urls: [], place_tags: [], place_media: []};
let records: typeof row[];
let reads: number;
let failure: boolean;

beforeEach(() => {
  records = [{...row}]; reads = 0; failure = false; cache.entries.clear(); cache.tags = [];
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://public-fixture.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-test-key');
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    expect(url.pathname).toBe('/rest/v1/places');
    expect(url.searchParams.get('status')).toBe('eq.published');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer public-test-key');
    reads++;
    return Response.json(failure ? {code: '42P01', message: 'relation missing'} : records,
      {status: failure ? 404 : 200});
  }));
});
afterEach(() => {vi.unstubAllGlobals(); vi.unstubAllEnvs();});

async function names() {
  const response = await GET();
  const result = await response.json();
  return {response, result, names: result.data?.items.map((item: {name: string}) => item.name)};
}

describe('public place list cache and write invalidation', () => {
  it('reuses public data but gives each request a fresh request id and no browser cache', async () => {
    const first = await names();
    records[0].name = '数据库新店名';
    const second = await names();
    expect(first.names).toEqual(['原店名']);
    expect(second.names).toEqual(['原店名']);
    expect(reads).toBe(1);
    expect(first.result.requestId).not.toBe(second.result.requestId);
    expect(second.response.headers.get('cache-control')).toBe('no-store');
  });

  it('does not cache unavailable schema results, so recovery is visible immediately', async () => {
    failure = true;
    expect((await names()).result.data.canonicalAvailable).toBe(false);
    failure = false;
    expect((await names()).names).toEqual(['原店名']);
    expect(reads).toBe(2);
  });

  it.each([false, true])('refreshes after an admin write even if a later step fails: %s', async lateFailure => {
    await names();
    const route = createAdminPlaceRoute(async () => {
      records[0].name = '管理员改名';
      if (lateFailure) throw {code: '23514'};
      return Response.json({ok: true});
    }, {authorize: async () => auth, client: () => ({}) as SupabaseClient});
    const response = await route(new Request('http://localhost/api/admin/places/x', {method: 'PATCH'}),
      {params: Promise.resolve({id})});
    expect(response.status).toBe(lateFailure ? 422 : 200);
    expect((await names()).names).toEqual(['管理员改名']);
  });

  it('does not invalidate for admin reads or denied writes', async () => {
    await names(); records[0].name = '不应读取';
    const read = createAdminPlaceRoute(async () => Response.json({ok: true}),
      {authorize: async () => auth, client: () => ({}) as SupabaseClient});
    await read(new Request('http://localhost/api/admin/places/x'), {params: Promise.resolve({id})});
    const denied = createAdminPlaceRoute(async () => {throw new Error('must not run');}, {
      authorize: async () => ({ok: false as const, error: {code: 'FORBIDDEN' as const, status: 403, message: 'denied'}}),
      client: () => ({}) as SupabaseClient
    });
    expect((await denied(new Request('http://localhost/api/admin/places/x', {method: 'PATCH'}),
      {params: Promise.resolve({id})})).status).toBe(403);
    expect((await names()).names).toEqual(['原店名']);
    expect(reads).toBe(1);
  });

  it.each(['POST', 'PATCH', 'DELETE', 'MODERATE'] as const)('refreshes list ratings after review %s', async method => {
    await names();
    const handlers = createReviewHandlers({authorizeUser: async () => auth, authorizeAdmin: async () => auth,
      client: () => ({
        from: () => {const query = {select: () => query, eq: () => query, is: () => query,
          maybeSingle: async () => ({data: {place_id: id}, error: null})}; return query;},
        rpc: async () => {
        records[0].review_count = 1;
        return {data: {id, place_id: id, user_id: id, rating: 4, content: '', status: 'published',
          moderation_status: 'pending', moderation_reason: null, deleted_at: null,
          created_at: '2026-10-20T00:00:00Z', updated_at: '2026-10-20T00:00:00Z'}, error: null};
      }}) as unknown as SupabaseClient});
    const response = await handlers[method](new Request(`http://localhost/api/places/${id}/reviews`, {
      method: method === 'MODERATE' ? 'PATCH' : method, headers: {'content-type': 'application/json'},
      body: JSON.stringify(method === 'MODERATE'
        ? {decision: 'approved', expectedUpdatedAt: '2026-10-20T00:00:00Z'}
        : method === 'DELETE' ? {expectedUpdatedAt: '2026-10-20T00:00:00Z'}
          : {rating: 4, expectedUpdatedAt: '2026-10-20T00:00:00Z'})
    }), {params: Promise.resolve({id})});
    expect(response.status).toBe(200);
    expect((await names()).result.data.items[0].reviews).toBe(1);
  });
});
