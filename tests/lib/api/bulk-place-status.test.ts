import {describe, expect, it, vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createAdminRoute} from '../../../lib/admin/api';
import {bulkPlaceStatusOperation} from '../../../lib/admin/bulk-place-status';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const updatedAt = '2026-10-19T08:00:00.123456+00:00';
const request = (body: unknown) => new Request('http://localhost/api/admin/places/bulk-status', {
  method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)
});
const body = {status: 'archived', items: [{id, updatedAt}, {id: other, updatedAt}]};
const context = {params: Promise.resolve({})};
function setup(rpc = vi.fn().mockResolvedValue({data: 'updated', error: null}), denied = false) {
  const client = vi.fn(() => ({rpc}) as unknown as SupabaseClient);
  const route = createAdminRoute<Record<string, never>>(bulkPlaceStatusOperation, {
    authorize: async () => denied
      ? {ok: false as const, error: {code: 'FORBIDDEN' as const, status: 403, message: '需要管理员权限'}}
      : {ok: true as const, user: {id: 'admin'}, role: 'admin' as const, accessToken: 'token'}, client
  });
  return {route, rpc, client};
}
describe('bulk place status API', () => {
  it('denies non-administrators before touching the database', async () => {
    const {route, client} = setup(undefined, true);
    expect((await route(request(body), context)).status).toBe(403);
    expect(client).not.toHaveBeenCalled();
  });
  it.each([
    {...body, status: 'deleted'}, {...body, items: []}, {...body, name: 'do not overwrite'},
    {...body, items: [body.items[0], body.items[0]]},
    {...body, items: [{id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', updatedAt}, {id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA', updatedAt}]},
    {...body, items: [{id, updatedAt: 'yesterday'}]},
    {...body, items: [{id, updatedAt, pricePerPerson: 1}]},
    {...body, items: Array.from({length: 51}, (_, i) => ({id: `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`, updatedAt}))}
  ])('rejects invalid or excessive requests without writes: %j', async input => {
    const {route, rpc} = setup();
    expect((await route(request(input), context)).status).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('sends only status, id and the exact timestamp to the dedicated RPC', async () => {
    const {route, rpc} = setup();
    const response = await route(request(body), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(rpc).toHaveBeenNthCalledWith(1, 'admin_set_place_status', {
      p_place_id: id, p_status: 'archived', p_expected_updated_at: updatedAt
    });
    expect((await response.json()).data.results).toEqual([
      {id, outcome: 'updated'}, {id: other, outcome: 'updated'}
    ]);
  });
  it('reports partial failures, stale data and unchanged rows honestly', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({data: 'unchanged', error: null})
      .mockResolvedValueOnce({data: null, error: {code: '40001', message: 'private sql details'}});
    const {route} = setup(rpc);
    const data = (await (await route(request(body), context)).json()).data;
    expect(data.results[0]).toEqual({id, outcome: 'unchanged'});
    expect(data.results[1]).toMatchObject({id: other, outcome: 'failed', code: 'CONFLICT'});
    expect(JSON.stringify(data)).not.toContain('private sql details');
  });
  it('does not report network exceptions as success or stop later items', async () => {
    const rpc = vi.fn().mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({data: 'updated', error: null});
    const {route} = setup(rpc);
    const data = (await (await route(request(body), context)).json()).data;
    expect(data.results[0]).toMatchObject({outcome: 'failed', code: 'UNKNOWN_RESULT'});
    expect(data.results[1].outcome).toBe('updated');
  });
  it('returns a clear setup error when the database function is missing', async () => {
    const {route, rpc} = setup(vi.fn().mockResolvedValue({data: null, error: {code: 'PGRST202'}}));
    const response = await route(request(body), context);
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('SCHEMA_UNAVAILABLE');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
