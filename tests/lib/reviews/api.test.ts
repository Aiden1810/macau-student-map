import {describe, expect, it, vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createReviewHandlers} from '../../../lib/reviews/handlers';

const id = '11111111-1111-4111-8111-111111111111';
const version = '2026-10-19T11:00:00.123456+00:00';
const row = {
  id,
  place_id: id,
  user_id: id,
  rating: 4,
  content: '体验不错',
  status: 'published',
  moderation_status: 'pending',
  moderation_reason: null,
  deleted_at: null,
  created_at: version,
  updated_at: version
};
const context = {params: Promise.resolve({id})};
const request = (body: unknown, method = 'POST') =>
  new Request('http://localhost/api/reviews', {
    method,
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(body)
  });
function setup(error: unknown = null, authorized = true, admin = true) {
  const rpc = vi.fn().mockResolvedValue({data: row, error});
  const client = vi.fn(() => ({rpc}) as unknown as SupabaseClient);
  const denied = {
    ok: false as const,
    error: {code: 'UNAUTHORIZED' as const, status: 401, message: '请先登录'}
  };
  const user = {ok: true as const, user: {id}, accessToken: 'test'};
  const handlers = createReviewHandlers({
    client,
    authorizeUser: async () => (authorized ? user : denied),
    authorizeAdmin: async () => (admin ? {...user, role: 'admin' as const} : denied)
  });
  return {handlers, rpc, client};
}
describe('review API guards and database contract', () => {
  it('denies anonymous writes before accessing the database', async () => {
    const {handlers, client} = setup(null, false);
    expect((await handlers.POST(request({rating: 4}), context)).status).toBe(401);
    expect(client).not.toHaveBeenCalled();
  });
  it.each([
    {rating: 0},
    {rating: 4.5},
    {rating: 4, status: 'published'},
    {rating: 4, userId: id},
    {rating: 4, expectedUpdatedAt: 'yesterday'}
  ])('rejects invalid or forged review fields: %j', async (body) => {
    const {handlers, rpc} = setup();
    expect((await handlers.POST(request(body), context)).status).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('uses the guarded RPC and preserves the precise concurrency timestamp', async () => {
    const {handlers, rpc} = setup();
    const response = await handlers.POST(
      request({rating: 4, content: '  体验不错  ', expectedUpdatedAt: version}),
      context
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(rpc).toHaveBeenCalledWith('save_place_review', {
      p_place_id: id,
      p_rating: 4,
      p_content: '体验不错',
      p_expected_updated_at: version
    });
    expect((await response.json()).data.moderationStatus).toBe('pending');
  });
  it.each([
    ['40001', 409, 'CONFLICT'],
    ['54000', 429, 'RATE_LIMITED'],
    ['PGRST202', 503, 'SCHEMA_UNAVAILABLE'],
    ['42501', 403, 'FORBIDDEN']
  ])('maps database failure %s without leaking its message', async (code, status, publicCode) => {
    const {handlers} = setup({code, message: 'private sql secret'});
    const response = await handlers.POST(request({rating: 4}), context);
    const json = await response.json();
    expect(response.status).toBe(status);
    expect(json.error.code).toBe(publicCode);
    expect(JSON.stringify(json)).not.toContain('private sql secret');
  });
  it('requires a version to delete and uses soft deletion RPC', async () => {
    const {handlers, rpc} = setup();
    expect((await handlers.DELETE(request({}, 'DELETE'), context)).status).toBe(422);
    expect((await handlers.DELETE(request({expectedUpdatedAt: version}, 'DELETE'), context)).status).toBe(
      200
    );
    expect(rpc).toHaveBeenCalledWith('delete_place_review', {
      p_review_id: id,
      p_expected_updated_at: version
    });
  });
  it('does not let a regular account moderate', async () => {
    const {handlers, client} = setup(null, true, false);
    expect(
      (await handlers.MODERATE(request({decision: 'approved', expectedUpdatedAt: version}, 'PATCH'), context))
        .status
    ).toBe(401);
    expect(client).not.toHaveBeenCalled();
  });
  it('requires a reason before hiding a review', async () => {
    const {handlers, rpc} = setup();
    expect(
      (await handlers.MODERATE(request({decision: 'rejected', expectedUpdatedAt: version}, 'PATCH'), context))
        .status
    ).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
    expect(
      (
        await handlers.MODERATE(
          request({decision: 'rejected', reason: '广告内容', expectedUpdatedAt: version}, 'PATCH'),
          context
        )
      ).status
    ).toBe(200);
    expect(rpc).toHaveBeenCalledWith('moderate_place_review', {
      p_review_id: id,
      p_decision: 'rejected',
      p_reason: '广告内容',
      p_expected_updated_at: version
    });
  });
});
