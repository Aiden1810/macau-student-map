import {describe, expect, it, vi} from 'vitest';
import {createAdminFeedbackHandlers, createFeedbackPostHandler} from '../../../lib/api/feedback-routes';
import type {FeedbackRecord} from '../../../lib/contact/feedback';

const id = '19aa9dfc-5b1d-4fb4-a1c0-c6d8288d3700';
const input = {id, category: 'issue' as const, place: '测试页面', message: '这是一条完整的界面反馈内容。', replyTo: '', locale: 'zh-CN' as const};
const row: FeedbackRecord = {id, user_id: 'user-a', category: 'issue', place: input.place, message: input.message, reply_to: '', locale: 'zh-CN', status: 'pending', created_at: '2026-10-18T12:00:00Z', handled_at: null, handled_by: null};
const request = (body: unknown, method = 'POST', path = '/api/feedback') => new Request(`http://localhost${path}`, {method, headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
const userDeps = () => ({
  authorize: vi.fn(async () => ({ok: true as const, user: {id: 'user-a'}, accessToken: 'user-token'})),
  client: vi.fn(() => ({})), insert: vi.fn(async () => ({data: row, error: null})),
  find: vi.fn(async () => ({data: row, error: null}))
});

describe('user feedback submission', () => {
  it('saves ownership from verified auth and only returns a receipt after persistence', async () => {
    const deps = userDeps();
    const response = await createFeedbackPostHandler(deps)(request(input));
    expect(response.status).toBe(201);
    expect(deps.insert).toHaveBeenCalledWith({}, {...input, userId: 'user-a'});
    expect(await response.json()).toMatchObject({ok: true, data: {id, createdAt: row.created_at}});
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('does not query or save for anonymous visitors', async () => {
    const deps = userDeps();
    const response = await createFeedbackPostHandler({...deps, authorize: async () => ({ok: false, error: {code: 'UNAUTHORIZED', status: 401, message: 'Login required'}})})(request(input));
    expect(response.status).toBe(401);
    expect(deps.insert).not.toHaveBeenCalled();
    expect(deps.client).not.toHaveBeenCalled();
  });
  it.each([{message: '短'}, {message: 'a'.repeat(2001)}, {user_id: 'other-user'}, {status: 'resolved'}, {category: 'unknown'}])('rejects invalid or forged input %j', async change => {
    const deps = userDeps();
    const response = await createFeedbackPostHandler(deps)(request({...input, ...change}));
    expect(response.status).toBe(422);
    expect(deps.insert).not.toHaveBeenCalled();
  });
  it('reports unavailable schema instead of pretending a submission succeeded', async () => {
    const deps = userDeps();
    const response = await createFeedbackPostHandler({...deps, insert: async () => ({data: null, error: {code: 'PGRST205'}})})(request(input));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ok: false, error: {code: 'SCHEMA_UNAVAILABLE'}});
  });
  it('does not acknowledge an empty or failed database write', async () => {
    const deps = userDeps();
    for (const error of [null, {code: '42501'}]) {
      const response = await createFeedbackPostHandler({...deps, insert: async () => ({data: null, error})})(request(input));
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ok: false});
    }
  });
  it('confirms the same saved item on retry after a lost response', async () => {
    const deps = userDeps();
    const response = await createFeedbackPostHandler({...deps, insert: async () => ({data: null, error: {code: '23505'}})})(request(input));
    expect(response.status).toBe(200);
    expect(deps.find).toHaveBeenCalledWith({}, id, 'user-a');
    expect(await response.json()).toMatchObject({ok: true, data: {id}});
  });
  it('does not expose or acknowledge another item with a conflicting id', async () => {
    const deps = userDeps();
    for (const data of [null, {...row, message: '另一条内容'}]) {
      const response = await createFeedbackPostHandler({...deps, insert: async () => ({data: null, error: {code: '23505'}}), find: async () => ({data, error: null})})(request(input));
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ok: false});
    }
  });
});

const adminDeps = () => ({
  authorize: vi.fn(async () => ({ok: true as const, user: {id: 'admin-a'}, role: 'admin' as const, accessToken: 'admin-token'})),
  client: vi.fn(() => ({})),
  list: vi.fn(async () => ({data: [row], count: 61, error: null})),
  count: vi.fn(async (_client: unknown, status: string) => ({count: status === 'pending' ? 61 : 12, error: null})),
  update: vi.fn(async () => ({data: {...row, status: 'resolved' as const}, error: null}))
});
describe('administrator feedback inbox', () => {
  it('enforces administrator authorization for both reading and handling', async () => {
    const deps = adminDeps();
    const handlers = createAdminFeedbackHandlers({...deps, authorize: async () => ({ok: false, error: {code: 'FORBIDDEN', status: 403, message: 'Admin required'}})});
    expect((await handlers.GET(new Request('http://localhost/api/admin/feedback'))).status).toBe(403);
    expect((await handlers.PATCH(request({status: 'resolved', expectedStatus: 'pending'}, 'PATCH'), id)).status).toBe(403);
    expect(deps.list).not.toHaveBeenCalled(); expect(deps.count).not.toHaveBeenCalled(); expect(deps.update).not.toHaveBeenCalled();
  });
  it('passes the selected status and page and returns exact counts', async () => {
    const deps = adminDeps();
    const response = await createAdminFeedbackHandlers(deps).GET(new Request('http://localhost/api/admin/feedback?status=pending&page=2'));
    expect(deps.list).toHaveBeenCalledWith({}, 'pending', 2);
    expect(await response.json()).toMatchObject({data: {total: 61, page: 2, stats: {pending: 61, resolved: 12}}});
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('does not turn a failed count into zero', async () => {
    const deps = adminDeps();
    const response = await createAdminFeedbackHandlers({...deps, count: async () => ({count: null, error: {code: '42501'}})}).GET(new Request('http://localhost/api/admin/feedback'));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ok: false});
  });
  it.each(['status=bad', 'page=-1', 'page=oops'])('rejects bad filters: %s', async params => {
    const deps = adminDeps();
    const response = await createAdminFeedbackHandlers(deps).GET(new Request(`http://localhost/api/admin/feedback?${params}`));
    expect(response.status).toBe(422); expect(deps.list).not.toHaveBeenCalled();
  });
  it('uses verified actor identity and checks the expected previous status', async () => {
    const deps = adminDeps();
    const response = await createAdminFeedbackHandlers(deps).PATCH(request({status: 'resolved', expectedStatus: 'pending'}, 'PATCH'), id);
    expect(response.status).toBe(200);
    expect(deps.update).toHaveBeenCalledWith({}, id, {status: 'resolved', expectedStatus: 'pending', actorId: 'admin-a'});
  });
  it('reports a concurrent change rather than claiming the update succeeded', async () => {
    const deps = adminDeps();
    const response = await createAdminFeedbackHandlers({...deps, update: async () => ({data: null, error: null})}).PATCH(request({status: 'resolved', expectedStatus: 'pending'}, 'PATCH'), id);
    expect(response.status).toBe(409);
  });
  it('rejects unknown identifiers and forbidden patch fields', async () => {
    const deps = adminDeps(); const handlers = createAdminFeedbackHandlers(deps);
    expect((await handlers.PATCH(request({status: 'resolved', expectedStatus: 'pending'}, 'PATCH'), 'bad-id')).status).toBe(422);
    expect((await handlers.PATCH(request({status: 'resolved', expectedStatus: 'pending', message: 'tampered'}, 'PATCH'), id)).status).toBe(422);
    expect(deps.update).not.toHaveBeenCalled();
  });
});
