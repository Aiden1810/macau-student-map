import {describe, expect, it} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createOperationsRoute} from '../../../lib/admin/operations-api';
import {auditItems, readRows} from '../../../lib/admin/operations-repository';

const context = {params: Promise.resolve({})};
const authorized = async () => ({ok: true as const, user: {id: 'admin'}, role: 'admin' as const, accessToken: 'token'});

describe('read-only platform operations boundary', () => {
  it.each([401, 403])('denies %s before accessing any report records', async status => {
    let accessed = false;
    const route = createOperationsRoute({
      authorize: async () => ({ok: false, error: {code: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', message: 'denied', status}}),
      client: () => {accessed = true; return {} as SupabaseClient;}
    });
    const response = await route(new Request('http://localhost/api/admin/operations'), context);
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(accessed).toBe(false);
  });
  it('rejects unsupported ranges before querying', async () => {
    const route = createOperationsRoute({authorize: authorized, client: () => ({} as SupabaseClient)});
    const response = await route(new Request('http://localhost/api/admin/operations?range=all'), context);
    expect(response.status).toBe(422);
  });
  it('reports independent query failures as unavailable instead of zero, without exposing database errors', async () => {
    const query = {
      select() {return this;}, eq() {return this;}, is() {return this;}, gte() {return this;}, lte() {return this;},
      order() {return this;}, range() {return this;}, abortSignal() {return this;},
      then(resolve: (value: unknown) => unknown) {return Promise.resolve({data: null, count: null, error: {code: '42703', message: 'secret database detail'}}).then(resolve);}
    };
    const route = createOperationsRoute({authorize: authorized, client: () => ({from: () => query}) as unknown as SupabaseClient});
    const response = await route(new Request('http://localhost/api/admin/operations?range=7d'), context);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.traffic.data).toBeNull();
    expect(body.data.pendingReviews.error).toContain('尚未启用');
    expect(JSON.stringify(body)).not.toContain('secret database detail');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('reads past a server page limit and discloses the cap rather than claiming a complete total', async () => {
    const rows = Array.from({length: 1205}, (_, id) => ({id}));
    const result = await readRows(async (from, to) => ({data: rows.slice(from, to + 1), count: 1205, error: null}), 1000);
    expect(result.rows).toHaveLength(1000);
    expect(result.total).toBe(1205);
    expect(result.incomplete).toBe(true);
  });
  it('handles a server limit smaller than the requested page without losing remaining rows', async () => {
    const rows = Array.from({length: 605}, (_, id) => ({id}));
    const result = await readRows(async (from, to) => ({data: rows.slice(from, Math.min(to + 1, from + 100)), count: 605, error: null}), 1000);
    expect(result.rows).toHaveLength(605);
    expect(result.incomplete).toBe(false);
  });
  it('does not silently return a partially successful dataset if a later page fails', async () => {
    await expect(readRows(async from => from === 0
      ? {data: [{id: 1}], count: 2, error: null}
      : {data: null, count: null, error: {code: 'network'}}, 1000)).rejects.toEqual({code: 'network'});
  });
  it('explains the actual dotted audit actions and nested place names written by existing RPCs', () => {
    const base = {id: 1, actor_id: 'administrator-private-id', entity_type: 'place', entity_id: 'p1', created_at: '2026-10-20T01:00:00Z'};
    const rows = auditItems([
      {...base, action: 'place.edit', metadata: {after: {name: '修改后店名'}}},
      {...base, action: 'submission.publish_edited', metadata: {published: {name: '审核后店名'}}},
      {...base, action: 'review.reject', metadata: {}}
    ]);
    expect(rows.map(row => [row.action, row.target])).toEqual([
      ['编辑地点', '修改后店名'], ['编辑并发布投稿', '审核后店名'], ['隐藏评价', '编号 p1']
    ]);
    expect(JSON.stringify(rows)).not.toContain('administrator-private-id');
  });
});
