import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const deps = vi.hoisted(() => ({
  requireUser: vi.fn(), rpc: vi.fn(), provider: vi.fn(), download: vi.fn(), from: vi.fn()
}));
vi.mock('@supabase/supabase-js', () => ({createClient: () => ({
  rpc: deps.rpc, storage: {from: () => ({download: deps.download})}
})}));
vi.mock('@/lib/auth/require-user', () => ({
  requireUser: deps.requireUser, createAuthenticatedSupabaseClient: () => ({rpc: deps.rpc, from: deps.from})
}));
vi.mock('@/lib/discovery/server', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/discovery/server')>(), queryAmap: deps.provider
}));

import {POST as favorite} from '@/app/api/discovery/favorite/route';
import {POST as recommend} from '@/app/api/discovery/recommendations/route';
import {GET as image} from '@/app/api/discovery/recommendations/[id]/image/route';

const actor = '10000000-0000-4000-8000-000000000001';
const id = '20000000-0000-4000-8000-000000000002';
const poiId = 'B000000001';
const target = {poiId};
const draft = {id, target, reason: '真实体验', hasImage: true};
const endpoint = 'http://localhost/api/discovery/';
const post = (name: string, value: object) => new Request(endpoint + name, {
  method: 'POST', headers: {Authorization: 'Bearer fixture', 'Content-Type': 'application/json'},
  body: JSON.stringify(value)
});
const getImage = (token?: string) => image(new Request(endpoint + 'recommendations/' + id + '/image', {
  headers: token ? {Authorization: 'Bearer ' + token} : {}
}), {params: Promise.resolve({id})});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('AMAP_ALLOW_POI_ID_PERSISTENCE', 'false');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'fixture-anon');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fixture-service');
  deps.requireUser.mockResolvedValue({ok: true, user: {id: actor}, accessToken: 'fixture'});
});
afterEach(() => vi.unstubAllEnvs());

describe('POI write protection', () => {
  it('returns a typed and uncacheable error before verifying or writing a dynamic favorite, recommendation or photo preflight', async () => {
    const responses = await Promise.all([
      favorite(post('favorite', {poiId, saved: true})),
      recommend(post('recommendations', draft)),
      recommend(post('recommendations?validate=true', draft))
    ]);
    for (const response of responses) {
      expect(response.status).toBe(503);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(await response.json()).toEqual({error: 'POI_PERSISTENCE_DISABLED'});
    }
    expect(deps.rpc).not.toHaveBeenCalled();
    expect(deps.provider).not.toHaveBeenCalled();
  });

  it('allows removing a saved POI and submitting a historical-place recommendation, binding the verified actor', async () => {
    deps.rpc.mockReturnValueOnce({abortSignal: async () => ({data: false, error: null})})
      .mockReturnValueOnce({abortSignal: async () => ({data: id, error: null})});
    expect((await favorite(post('favorite', {poiId, saved: false}))).status).toBe(200);
    expect((await recommend(post('recommendations', {...draft, target: {placeId: id}, hasImage: false}))).status).toBe(201);
    expect(deps.rpc.mock.calls[0]).toEqual(['save_verified_discovery_favorite', {p_actor: actor, p_poi: poiId, p_saved: false}]);
    expect(deps.rpc.mock.calls[1][1]).toMatchObject({p_actor: actor, p_place: id, p_poi: null});
    expect((await recommend(post('recommendations', {...draft, actor: id}))).status).toBe(400);
    expect(deps.rpc).toHaveBeenCalledTimes(2);
  });

  it('rejects photo preflight for an unavailable historical place', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({data: null, error: null})
    };
    deps.from.mockReturnValue(chain);
    const result = await recommend(post('recommendations?validate=true', {...draft, target: {placeId: id}}));
    expect(result.status).toBe(404);
    expect(await result.json()).toEqual({error: 'PLACE_UNAVAILABLE'});
    expect(chain.eq.mock.calls).toEqual([['id', id], ['status', 'published']]);
    expect(deps.rpc).not.toHaveBeenCalled();
  });

  it('rejects anonymous requests without accessing provider or database', async () => {
    deps.requireUser.mockResolvedValue({ok: false});
    expect((await favorite(post('favorite', {poiId, saved: false}))).status).toBe(401);
    expect((await recommend(post('recommendations', draft))).status).toBe(401);
    expect(deps.rpc).not.toHaveBeenCalled();
  });
});

describe('recommendation image route', () => {
  it('checks authorization before Storage and returns private bytes with no reusable URL', async () => {
    deps.rpc.mockReturnValueOnce({abortSignal: async () => ({data: null, error: null})});
    expect((await getImage()).status).toBe(404);
    expect(deps.download).not.toHaveBeenCalled();

    deps.rpc.mockReturnValueOnce({abortSignal: async () => ({data: id, error: null})});
    const payload = new Uint8Array([255, 216, 255, 217]);
    deps.download.mockResolvedValueOnce({data: new Blob([payload], {type: 'image/jpeg'}), error: null});
    const result = await getImage('moderator-fixture-token');
    expect(result.status).toBe(200);
    expect(result.headers.get('Cache-Control')).toBe('private, no-store');
    expect(result.headers.get('Content-Type')).toBe('image/jpeg');
    expect(result.headers.get('Location')).toBeNull();
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(payload);

    deps.rpc.mockReturnValueOnce({abortSignal: async () => ({data: null, error: null})});
    expect((await getImage('moderator-fixture-token')).status).toBe(404);
    expect(deps.download).toHaveBeenCalledTimes(1);
  });
});
