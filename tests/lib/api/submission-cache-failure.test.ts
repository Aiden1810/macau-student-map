import {describe, expect, it, vi} from 'vitest';

vi.mock('../../../lib/auth/require-admin', () => ({requireAdmin: async () => ({
  ok: true, user: {id: 'admin'}, role: 'admin', accessToken: 'fixture'
})}));
vi.mock('../../../lib/auth/require-user', () => ({createAuthenticatedSupabaseClient: () => ({
  rpc: async () => ({data: '11111111-1111-4111-8111-111111111111', error: null})
})}));
vi.mock('../../../lib/data/tag-catalog', () => ({checkSubmissionTagCatalog: async () => 'available'}));
vi.mock('../../../lib/services/media', () => ({transferApprovedSubmissionMedia: async () => {
  throw new Error('private network details');
}}));
vi.mock('next/cache', () => ({revalidateTag: () => undefined}));

import {POST as approve} from '../../../app/api/admin/submissions/[id]/approve/route';
import {POST as merge} from '../../../app/api/admin/submissions/[id]/merge/route';

describe('submission response after a committed write and failed media step', () => {
  it.each([['approve', approve], ['merge', merge]] as const)('%s returns a Response so Next can flush pending cache invalidations', async (name, handler) => {
    const response = await handler(new Request(`http://localhost/api/admin/submissions/x/${name}`, {
      method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({reviewNote: '', ...(name === 'merge' ? {targetPlaceId: '11111111-1111-4111-8111-111111111111'} : {})})
    }), {params: Promise.resolve({id: '22222222-2222-4222-8222-222222222222'})});
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(data)).not.toContain('private network details');
  });
});
