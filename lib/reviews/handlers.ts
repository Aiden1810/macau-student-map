import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {requireUser, createAuthenticatedSupabaseClient, type UserAuthResult} from '../auth/require-user';
import {requireAdmin, type AdminAuthResult} from '../auth/require-admin';
import {errorResponse, successResponse, type ApiErrorDescriptor} from '../api/result';
import {parseJsonBody} from '../api/request';
import {
  reviewWriteSchema,
  reviewDeleteSchema,
  reviewModerationSchema,
  REVIEW_PAGE_SIZE
} from '../domain/review';
import {mapReviewRow} from '../data/review-repository';

export const REVIEW_COLUMNS =
  'id,place_id,user_id,rating,content,status,moderation_status,moderation_reason,deleted_at,created_at,updated_at';
type Context = {params: Promise<{id: string}>};
type Dependencies = {
  client: (token: string) => SupabaseClient;
  authorizeUser: (request: Request) => Promise<UserAuthResult>;
  authorizeAdmin: (request: Request) => Promise<AdminAuthResult>;
  publicClient?: () => SupabaseClient;
};
const uuid = z.string().uuid();
const querySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'deleted', 'all']).default('pending'),
  page: z.coerce.number().int().min(0).max(100000).default(0)
});
function databaseFailure(error: unknown): Response {
  const code = (error as {code?: string})?.code;
  const descriptor: ApiErrorDescriptor =
    code === '40001' || code === '23505'
      ? {code: 'CONFLICT', status: 409, message: '评价已被更新，请先刷新再操作。'}
      : code === '54000'
        ? {code: 'RATE_LIMITED', status: 429, message: '提交过于频繁，请间隔 10 秒后再试。'}
        : code === 'PGRST202' || code === '42883' || code === '42703' || code === '42P01'
          ? {code: 'SCHEMA_UNAVAILABLE', status: 503, message: '评价功能正在升级，请稍后再试。'}
          : code === '42501'
            ? {code: 'FORBIDDEN', status: 403, message: '没有权限执行此操作。'}
            : code === 'P0002'
              ? {code: 'NOT_FOUND', status: 404, message: '店铺或评价不存在，或已不可操作。'}
              : code === '23514' || code === '22P02'
                ? {code: 'VALIDATION_ERROR', status: 422, message: '评价内容或评分不符合要求。'}
                : {code: 'INTERNAL_ERROR', status: 500, message: '无法确认操作结果，请刷新核对后再重试。'};
  const response = errorResponse(descriptor);
  if (descriptor.status === 429) response.headers.set('retry-after', '10');
  return response;
}
function privateResponse(response: Response): Response {
  response.headers.set('cache-control', 'private, no-store');
  return response;
}
async function resolvePlace(client: SupabaseClient, id: string) {
  const {data, error} = await client
    .from('places')
    .select('id,rating_average,review_count')
    .or(`id.eq.${id},legacy_shop_id.eq.${id}`)
    .eq('status', 'published')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw {code: 'P0002'};
  return data as {id: string; rating_average: number | null; review_count: number};
}
export function createReviewHandlers(
  dependencies: Dependencies = {
    client: createAuthenticatedSupabaseClient,
    authorizeUser: requireUser,
    authorizeAdmin: requireAdmin
  }
) {
  const wrap =
    (operation: (request: Request, id: string) => Promise<Response>, publicRead = false) =>
    async (request: Request, context: Context) => {
      let response: Response;
      try {
        const id = (await context.params).id;
        response = uuid.safeParse(id).success
          ? await operation(request, id)
          : errorResponse({code: 'VALIDATION_ERROR', status: 422, message: '评价或店铺编号无效。'});
      } catch (error) {
        response = databaseFailure(error);
      }
      response.headers.set('cache-control', publicRead ? 'no-store' : 'private, no-store');
      return response;
    };
  const POST = wrap(async (request, id) => {
    const auth = await dependencies.authorizeUser(request);
    if (!auth.ok) return errorResponse(auth.error);
    const body = await parseJsonBody(request, reviewWriteSchema);
    if (!body.ok) return errorResponse(body.error);
    const {data, error} = await dependencies.client(auth.accessToken).rpc('save_place_review', {
      p_place_id: id,
      p_rating: body.data.rating,
      p_content: body.data.content,
      p_expected_updated_at: body.data.expectedUpdatedAt
    });
    if (error) throw error;
    return successResponse(mapReviewRow(data));
  });
  const MINE = wrap(async (request, id) => {
    const auth = await dependencies.authorizeUser(request);
    if (!auth.ok) return errorResponse(auth.error);
    const client = dependencies.client(auth.accessToken);
    const place = await resolvePlace(client, id);
    const {data, error} = await client
      .from('reviews')
      .select(REVIEW_COLUMNS)
      .eq('place_id', place.id)
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (error) throw error;
    return successResponse({review: data ? mapReviewRow(data) : null});
  });
  const DELETE = wrap(async (request, id) => {
    const auth = await dependencies.authorizeUser(request);
    if (!auth.ok) return errorResponse(auth.error);
    const body = await parseJsonBody(request, reviewDeleteSchema);
    if (!body.ok) return errorResponse(body.error);
    const {data, error} = await dependencies
      .client(auth.accessToken)
      .rpc('delete_place_review', {p_review_id: id, p_expected_updated_at: body.data.expectedUpdatedAt});
    if (error) throw error;
    return successResponse(mapReviewRow(data));
  });
  const PATCH = wrap(async (request, id) => {
    const auth = await dependencies.authorizeUser(request);
    if (!auth.ok) return errorResponse(auth.error);
    const body = await parseJsonBody(request, reviewWriteSchema);
    if (!body.ok) return errorResponse(body.error);
    if (!body.data.expectedUpdatedAt)
      return errorResponse({code: 'VALIDATION_ERROR', status: 422, message: '请先读取原评价。'});
    const client = dependencies.client(auth.accessToken);
    const {data: owned, error: lookupError} = await client
      .from('reviews')
      .select('place_id')
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!owned) throw {code: 'P0002'};
    const {data, error} = await client.rpc('save_place_review', {
      p_place_id: owned.place_id,
      p_rating: body.data.rating,
      p_content: body.data.content,
      p_expected_updated_at: body.data.expectedUpdatedAt
    });
    if (error) throw error;
    return successResponse(mapReviewRow(data));
  });
  const MODERATE = wrap(async (request, id) => {
    const auth = await dependencies.authorizeAdmin(request);
    if (!auth.ok) return errorResponse(auth.error);
    const body = await parseJsonBody(request, reviewModerationSchema);
    if (!body.ok) return errorResponse(body.error);
    const {data, error} = await dependencies.client(auth.accessToken).rpc('moderate_place_review', {
      p_review_id: id,
      p_decision: body.data.decision,
      p_reason: body.data.reason,
      p_expected_updated_at: body.data.expectedUpdatedAt
    });
    if (error) throw error;
    return successResponse(mapReviewRow(data));
  });
  const ADMIN_LIST = async (request: Request) => {
    let response: Response;
    try {
      const auth = await dependencies.authorizeAdmin(request);
      if (!auth.ok) return privateResponse(errorResponse(auth.error));
      const url = new URL(request.url);
      const filter = querySchema.safeParse(Object.fromEntries(url.searchParams));
      if (!filter.success)
        return privateResponse(
          errorResponse({code: 'VALIDATION_ERROR', status: 422, message: '筛选或页码无效。'})
        );
      const {status, page} = filter.data;
      const start = page * REVIEW_PAGE_SIZE;
      let query = dependencies
        .client(auth.accessToken)
        .from('reviews')
        .select(`${REVIEW_COLUMNS},places(name)`, {count: 'exact'});
      if (status === 'deleted') query = query.not('deleted_at', 'is', null);
      else if (status !== 'all') query = query.is('deleted_at', null).eq('moderation_status', status);
      const {data, error, count} = await query
        .order('updated_at', {ascending: false})
        .order('id')
        .range(start, start + REVIEW_PAGE_SIZE - 1);
      if (error) throw error;
      response = successResponse({
        items: (data ?? []).map((row) => ({
          ...mapReviewRow(row),
          placeName: (row.places as unknown as {name: string} | null)?.name ?? '店铺已移除'
        })),
        total: count ?? 0,
        page
      });
    } catch (error) {
      response = databaseFailure(error);
    }
    response.headers.set('cache-control', 'private, no-store');
    return response;
  };
  const GET = wrap(async (_request, id) => {
    const client =
      dependencies.publicClient?.() ??
      createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: {persistSession: false, autoRefreshToken: false}
      });
    const place = await resolvePlace(client, id);
    const {data, error, count} = await client
      .from('reviews')
      .select('id,place_id,rating,content,created_at,updated_at', {count: 'exact'})
      .eq('place_id', place.id)
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('created_at', {ascending: false})
      .limit(100);
    if (error) throw error;
    return successResponse({
      items: (data ?? []).map((row) => ({
        id: row.id,
        placeId: row.place_id,
        rating: row.rating,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      summary: {average: place.rating_average, count: place.review_count},
      total: count ?? 0
    });
  }, true);
  return {POST, GET, MINE, PATCH, DELETE, MODERATE, ADMIN_LIST};
}
export const reviewHandlers = createReviewHandlers();
