import {describe, expect, it} from 'vitest';
import {
  createAdminSubmissionsGetHandler,
  type AdminSubmissionStatus
} from '../../../lib/api/admin-submissions-route';

const pendingRow = {
  id: '11111111-1111-4111-8111-111111111111',
  source_place_id: null,
  merged_into_place_id: null,
  name: '校园汉堡研究所',
  address: '澳门氹仔大学大马路',
  category_slug: 'food',
  region: 'taipa',
  longitude: 113.5567,
  latitude: 22.1634,
  price_per_person: 58,
  tag_ids: ['00000000-0000-0000-0000-000000000501'],
  notes: null,
  status: 'pending',
  submitted_by: '22222222-2222-4222-8222-222222222222',
  version: 2,
  submitted_at: '2026-09-07T08:00:00.000Z',
  reviewed_at: null,
  review_note: null,
  created_at: '2026-09-07T07:00:00.000Z',
  updated_at: '2026-09-07T08:00:00.000Z'
};

function createHandler(options?: {
  rows?: unknown[];
  counts?: Partial<Record<AdminSubmissionStatus, number>>;
  countErrorStatus?: AdminSubmissionStatus;
}) {
  const counts = {
    pending: 201,
    approved: 12,
    merged: 3,
    rejected: 4,
    ...options?.counts
  };

  return createAdminSubmissionsGetHandler({
    requireAdmin: async () => ({
      ok: true,
      user: {id: 'admin-user'},
      accessToken: 'token',
      role: 'admin'
    }),
    createClient: () => ({kind: 'fake-client'}),
    listPending: async () => ({data: options?.rows ?? [pendingRow], error: null}),
    countByStatus: async (_client, status) =>
      status === options?.countErrorStatus
        ? {count: null, error: {message: `${status} count failed`}}
        : {count: counts[status], error: null}
  });
}

describe('GET /api/admin/submissions', () => {
  it('returns pending items and exact counts for every moderation outcome', async () => {
    const response = await createHandler()(new Request('http://localhost/api/admin/submissions'));
    const body = (await response.json()) as {
      ok: boolean;
      data: {
        items: Array<{id: string; status: string}>;
        stats: Record<AdminSubmissionStatus, number>;
      };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]).toMatchObject({id: pendingRow.id, status: 'pending'});
    expect(body.data.stats).toEqual({pending: 201, approved: 12, merged: 3, rejected: 4});
  });

  it('marks successful responses as private and non-cacheable', async () => {
    const response = await createHandler()(new Request('http://localhost/api/admin/submissions'));

    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('returns an error instead of silently converting a failed count to zero', async () => {
    const response = await createHandler({countErrorStatus: 'approved'})(
      new Request('http://localhost/api/admin/submissions')
    );
    const body = (await response.json()) as {ok: boolean; error: {code: string}};

    expect(response.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('returns the admin authorization failure without querying submissions', async () => {
    let queried = false;
    const handler = createAdminSubmissionsGetHandler({
      requireAdmin: async () => ({
        ok: false,
        error: {code: 'FORBIDDEN', message: 'Administrator permission is required.', status: 403}
      }),
      createClient: () => ({kind: 'fake-client'}),
      listPending: async () => {
        queried = true;
        return {data: [], error: null};
      },
      countByStatus: async () => {
        queried = true;
        return {count: 0, error: null};
      }
    });

    const response = await handler(new Request('http://localhost/api/admin/submissions'));

    expect(response.status).toBe(403);
    expect(queried).toBe(false);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
