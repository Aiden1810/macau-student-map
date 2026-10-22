import type {SupabaseClient} from '@supabase/supabase-js';
import {describe, expect, it, vi} from 'vitest';
import {createRegistrationStatsRoute} from '../../../lib/admin/registrations-api';
import {createUsageRoute} from '../../../lib/admin/usage-api';
const context = {params: Promise.resolve({})};
const authorized = async () => ({
  ok: true as const,
  user: {id: 'admin'},
  role: 'admin' as const,
  accessToken: 'token',
});
describe('registration and usage report API authorization', () => {
  it.each([401, 403])(
    'refuses %s before any database access',
    async (status) => {
      const client = vi.fn();
      const deps = {
        authorize: async () => ({
          ok: false as const,
          error: {
            code:
              status === 401
                ? ('UNAUTHORIZED' as const)
                : ('FORBIDDEN' as const),
            message: 'denied',
            status,
          },
        }),
        client,
      };
      for (const make of [createRegistrationStatsRoute, createUsageRoute]) {
        const response = await make(deps)(
          new Request('http://localhost/api/admin/report'),
          context,
        );
        expect(response.status).toBe(status);
        expect(response.headers.get('cache-control')).toBe('private, no-store');
      }
      expect(client).not.toHaveBeenCalled();
    },
  );
  it('rejects invalid ranges and keeps unavailable statistics distinct from zero', async () => {
    const rpc = vi.fn().mockResolvedValue({error: {code: '42501'}, data: null});
    const deps = {
      authorize: authorized,
      client: () => ({rpc}) as unknown as SupabaseClient,
    };
    expect(
      (
        await createUsageRoute(deps)(
          new Request('http://localhost/api/admin/usage?range=all'),
          context,
        )
      ).status,
    ).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
    expect(
      (
        await createRegistrationStatsRoute(deps)(
          new Request('http://localhost/api/admin/users/stats'),
          context,
        )
      ).status,
    ).toBe(403);
  });
  it('returns only aggregate registration fields and sends the selected range to the database', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({
        error: null,
        data: {
          range: '24h',
          rangeStart: 0,
          updatedAt: 1,
          total: 10,
          newUsers: 2,
          timeline: [{timestamp: 0, label: '10/22', count: 2}],
          email: 'never expose',
        },
      });
    const response = await createRegistrationStatsRoute({
      authorize: authorized,
      client: () => ({rpc}) as unknown as SupabaseClient,
    })(
      new Request('http://localhost/api/admin/users/stats?range=24h'),
      context,
    );
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toContain('never expose');
    expect(rpc).toHaveBeenCalledWith('admin_registration_stats', {
      p_range: '24h',
    });
  });
});
