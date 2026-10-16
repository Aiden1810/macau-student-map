import {describe, expect, it} from 'vitest';
import {createAdminRoute} from '../../../lib/admin/api';
import type {SupabaseClient} from '@supabase/supabase-js';

describe('admin editor API boundary', () => {
  it('denies members before running an operation or creating a database client', async () => {
    let accessed = false;
    const route = createAdminRoute(async () => {accessed = true; return Response.json({});}, {
      authorize: async () => ({ok: false, error: {code: 'FORBIDDEN', message: '需要管理员权限', status: 403}}),
      client: () => {accessed = true; return {} as SupabaseClient;}
    });
    const response = await route(new Request('http://localhost'), {params: Promise.resolve({id: ''})});
    expect(response.status).toBe(403);
    expect(accessed).toBe(false);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it.each([['40001', 409], ['23514', 422], ['P0002', 404], ['42501', 403]])(
    'returns a usable status for database failure %s', async (code, status) => {
      const route = createAdminRoute(async () => {throw {code, message: 'database failure'};}, {
        authorize: async () => ({ok: true, user: {id: 'admin'}, role: 'admin', accessToken: 'token'}),
        client: () => ({} as SupabaseClient)
      });
      const response = await route(new Request('http://localhost'), {params: Promise.resolve({id: ''})});
      expect(response.status).toBe(status);
      expect((await response.json()).ok).toBe(false);
    }
  );
});
