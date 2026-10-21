import {z} from 'zod';
import {createAdminRoute} from './api';
import {userDirectorySchema} from './accounts';
import {errorResponse, successResponse} from '../api/result';

const querySchema = z.object({q: z.string().trim().max(200), page: z.coerce.number().int().min(1).max(1000000)});

export function createUsersRoute(dependencies?: Parameters<typeof createAdminRoute>[1]) {
  return createAdminRoute<Record<string, never>>(async (request, client) => {
    const params = new URL(request.url).searchParams;
    const query = querySchema.safeParse({q: params.get('q') ?? '', page: params.get('page') ?? '1'});
    if (!query.success) return errorResponse({code: 'VALIDATION_ERROR', status: 422, message: '请检查搜索内容和页码。'});
    const {data, error} = await client.rpc('admin_list_users', {p_query: query.data.q, p_page: query.data.page, p_page_size: 25});
    if (error) throw error;
    return successResponse(userDirectorySchema.parse(data));
  }, dependencies);
}
