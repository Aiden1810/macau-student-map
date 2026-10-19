import {z} from 'zod';
import type {UserAuthResult} from '../auth/require-user';
import type {AdminAuthResult} from '../auth/require-admin';
import {feedbackSchema, feedbackUpdateSchema, type FeedbackWrite, type FeedbackRecord, type FeedbackFilter, type FeedbackStatus} from '../contact/feedback';
import {parseJsonBody} from './request';
import {errorResponse, successResponse, type ApiErrorDescriptor} from './result';

type QueryError = {code?: string; message?: string};
type RowResult = {data: FeedbackRecord | null; error: QueryError | null};
type CountResult = {count: number | null; error: QueryError | null};

type UserDependencies<Client> = {
  authorize: (request: Request) => Promise<UserAuthResult>;
  client: (token: string) => Client;
  insert: (client: Client, input: FeedbackWrite) => Promise<RowResult>;
  find: (client: Client, id: string, userId: string) => Promise<RowResult>;
};
type AdminDependencies<Client> = {
  authorize: (request: Request) => Promise<AdminAuthResult>;
  client: (token: string) => Client;
  list: (client: Client, status: FeedbackFilter, page: number) => Promise<{data: FeedbackRecord[] | null; count: number | null; error: QueryError | null}>;
  count: (client: Client, status: FeedbackStatus) => Promise<CountResult>;
  update: (client: Client, id: string, input: {status: FeedbackStatus; expectedStatus: FeedbackStatus; actorId: string}) => Promise<RowResult>;
};

function privateResponse(response: Response) {response.headers.set('cache-control', 'private, no-store'); return response;}
function failure(error?: QueryError | null) {
  const unavailable = ['42P01', 'PGRST205'].includes(error?.code ?? '');
  return privateResponse(errorResponse({
    code: unavailable ? 'SCHEMA_UNAVAILABLE' : 'INTERNAL_ERROR', status: unavailable ? 503 : 500,
    message: unavailable ? '反馈功能尚未启用，请稍后重试。' : '反馈操作失败，请稍后重试。'
  }));
}
const denied = (error: ApiErrorDescriptor) => privateResponse(errorResponse(error));

export function createFeedbackPostHandler<Client>(deps: UserDependencies<Client>) {
  return async (request: Request) => {
    try {
      const auth = await deps.authorize(request);
      if (!auth.ok) return denied(auth.error);
      const body = await parseJsonBody(request, feedbackSchema, {maxBytes: 16 * 1024});
      if (!body.ok) return denied(body.error);
      const client = deps.client(auth.accessToken);
      const result = await deps.insert(client, {...body.data, userId: auth.user.id});
      let saved = result.data;
      if (result.error?.code === '23505') {
        // A retry after a lost response must not create a second feedback item.
        const previous = await deps.find(client, body.data.id, auth.user.id);
        const row = previous.data;
        if (previous.error) return failure(previous.error);
        if (!row || row.category !== body.data.category || row.place !== body.data.place || row.message !== body.data.message || row.reply_to !== body.data.replyTo || row.locale !== body.data.locale) {
          return denied({code: 'CONFLICT', status: 409, message: '提交编号已被使用，请重新提交。'});
        }
        saved = row;
      } else if (result.error) return failure(result.error);
      if (!saved) return failure();
      return privateResponse(successResponse({id: saved.id, createdAt: saved.created_at}, {status: result.error ? 200 : 201}));
    } catch {return failure();}
  };
}

export function createAdminFeedbackHandlers<Client>(deps: AdminDependencies<Client>) {
  return {
    GET: async (request: Request) => {
      try {
        const auth = await deps.authorize(request);
        if (!auth.ok) return denied(auth.error);
        const params = new URL(request.url).searchParams;
        const parsed = z.object({status: z.enum(['all', 'pending', 'resolved']), page: z.coerce.number().int().min(0).max(100000)}).safeParse({status: params.get('status') ?? 'pending', page: params.get('page') ?? '0'});
        if (!parsed.success) return denied({code: 'VALIDATION_ERROR', status: 422, message: '反馈筛选条件无效。'});
        const client = deps.client(auth.accessToken);
        const [items, pending, resolved] = await Promise.all([deps.list(client, parsed.data.status, parsed.data.page), deps.count(client, 'pending'), deps.count(client, 'resolved')]);
        const error = items.error ?? pending.error ?? resolved.error;
        if (error || items.count === null || pending.count === null || resolved.count === null) return failure(error);
        return privateResponse(successResponse({items: items.data ?? [], total: items.count, page: parsed.data.page, stats: {pending: pending.count, resolved: resolved.count}}));
      } catch {return failure();}
    },
    PATCH: async (request: Request, id: string) => {
      try {
        const auth = await deps.authorize(request);
        if (!auth.ok) return denied(auth.error);
        if (!z.uuid().safeParse(id).success) return denied({code: 'VALIDATION_ERROR', status: 422, message: '反馈编号无效。'});
        const body = await parseJsonBody(request, feedbackUpdateSchema);
        if (!body.ok) return denied(body.error);
        const result = await deps.update(deps.client(auth.accessToken), id, {...body.data, actorId: auth.user.id});
        if (result.error) return failure(result.error);
        if (!result.data) return denied({code: 'CONFLICT', status: 409, message: '反馈已发生变化，请刷新后重试。'});
        return privateResponse(successResponse({id: result.data.id, status: result.data.status}));
      } catch {return failure();}
    }
  };
}
