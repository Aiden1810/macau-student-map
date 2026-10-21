import type {SupabaseClient} from '@supabase/supabase-js';
import {describe, expect, it, vi} from 'vitest';
import {createUsersRoute} from '../../../lib/admin/users-api';
import {readAccountEmails} from '../../../lib/admin/accounts';
import {mapAdminPlace} from '../../../lib/admin/place-data';

const context = {params: Promise.resolve({})};
const authorized = async () => ({ok: true as const, user: {id: 'admin'}, role: 'admin' as const, accessToken: 'token'});
const member = '22222222-2222-4222-8222-222222222222';
describe('admin account HTTP boundary and attribution', () => {
  it.each([401, 403])('denies %s before creating a database client', async status => {
    const client = vi.fn();
    const route = createUsersRoute({authorize: async () => ({ok: false,
      error: {code: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', message: 'denied', status}}), client});
    const response = await route(new Request('http://localhost/api/admin/users'), context);
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(client).not.toHaveBeenCalled();
  });
  it('validates pagination before querying accounts', async () => {
    const rpc = vi.fn();
    const route = createUsersRoute({authorize: authorized, client: () => ({rpc}) as unknown as SupabaseClient});
    for (const params of ['page=0', 'page=1.5', 'page=1000001', `q=${'x'.repeat(201)}`]) {
      expect((await route(new Request(`http://localhost/api/admin/users?${params}`), context)).status).toBe(422);
    }
    expect(rpc).not.toHaveBeenCalled();
  });
  it('returns private paginated accounts and strips unrequested auth fields', async () => {
    const rpc = vi.fn().mockResolvedValue({error: null, data: {total: 26, matched: 1, page: 2, pageSize: 25,
      items: [{id: member, email: 'student@example.test', createdAt: '2026-10-21T01:00:00Z', role: 'member', encrypted_password: 'never expose'}]}});
    const route = createUsersRoute({authorize: authorized, client: () => ({rpc}) as unknown as SupabaseClient});
    const response = await route(new Request('http://localhost/api/admin/users?page=2&q=student'), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const body = await response.json();
    expect(body.data).toMatchObject({total: 26, matched: 1});
    expect(JSON.stringify(body)).not.toContain('never expose');
    expect(rpc).toHaveBeenCalledWith('admin_list_users', {p_query: 'student', p_page: 2, p_page_size: 25});
  });
  it('does not turn a missing migration or failed lookup into an empty successful result', async () => {
    const rpc = vi.fn().mockResolvedValue({error: {code: '42501', message: 'denied'}, data: null});
    const client = {rpc} as unknown as SupabaseClient;
    const response = await createUsersRoute({authorize: authorized, client: () => client})(new Request('http://localhost/api/admin/users'), context);
    expect(response.status).toBe(403);
    await expect(readAccountEmails(client, [member])).rejects.toMatchObject({code: '42501'});
  });
  it('deduplicates account IDs in one lookup and skips empty batches', async () => {
    const rpc = vi.fn().mockResolvedValue({error: null, data: [{user_id: member, email: 'student@example.test'}]});
    const client = {rpc} as unknown as SupabaseClient;
    expect((await readAccountEmails(client, [member, member, null])).get(member)).toBe('student@example.test');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('admin_account_emails', {p_user_ids: [member]});
    expect((await readAccountEmails(client, [])).size).toBe(0);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('uses the stored creator instead of the current administrator and leaves old sources unknown', async () => {
    const client = {} as SupabaseClient;
    const row = {id: 'p1', name: '测试店', name_en: null, address: null, category_slug: 'food' as const,
      region: null, longitude: null, latitude: null, price_per_person: null, status: 'draft' as const,
      updated_at: '2026-10-21T01:00:00Z', search_keywords_manual: [], place_tags: [], place_media: [], created_by: member};
    const accounts = new Map([[member, 'student@example.test']]);
    expect((await mapAdminPlace(client, row, accounts)).createdBy).toEqual({id: member, email: 'student@example.test'});
    expect((await mapAdminPlace(client, {...row, created_by: null}, accounts)).createdBy).toBeNull();
    expect((await mapAdminPlace(client, row, new Map())).createdBy).toEqual({id: member, email: null});
  });
});
