import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {postgresUuid} from './place-editor';
import {MAX_BULK_PLACES, type BulkPlaceResult} from './bulk-place-selection';
import {parseJsonBody} from '../api/request';
import {errorResponse, successResponse} from '../api/result';

const bulkStatusSchema = z.object({
  status: z.enum(['published', 'archived']),
  items: z.array(z.object({id: postgresUuid.transform(value => value.toLowerCase()), updatedAt: z.iso.datetime({offset: true})}).strict())
    .min(1).max(MAX_BULK_PLACES)
    .refine(items => new Set(items.map(item => item.id)).size === items.length, '不能重复选择店铺')
}).strict();

function failed(id: string, code?: string): BulkPlaceResult {
  if (code === '40001') return {id, outcome: 'failed', code: 'CONFLICT', message: '资料已变更，请刷新后重试。'};
  if (code === 'P0002') return {id, outcome: 'failed', code: 'NOT_FOUND', message: '店铺不存在，请刷新列表。'};
  if (code === '42501') return {id, outcome: 'failed', code: 'FORBIDDEN', message: '管理员权限已失效，请重新登录。'};
  if (code === '23514') return {id, outcome: 'failed', code: 'VALIDATION_ERROR', message: '资料不符合上线要求，或属于旧版店铺；请先编辑检查类型、标签与地图位置。'};
  return {id, outcome: 'failed', code: 'UNKNOWN_RESULT', message: '操作结果未能确认，请刷新检查实际状态后重试。'};
}

/** Each RPC is an independent transaction: one invalid place does not undo other successful rows. */
export async function bulkPlaceStatusOperation(request: Request, client: SupabaseClient): Promise<Response> {
  const body = await parseJsonBody(request, bulkStatusSchema, {maxBytes: 16 * 1024});
  if (!body.ok) return errorResponse(body.error);
  const results: BulkPlaceResult[] = [];
  for (const item of body.data.items) {
    try {
      const {data, error} = await client.rpc('admin_set_place_status', {
        p_place_id: item.id, p_status: body.data.status, p_expected_updated_at: item.updatedAt
      });
      if (error?.code === 'PGRST202' && results.length === 0) return errorResponse({
        code: 'SCHEMA_UNAVAILABLE', status: 503, message: '批量状态功能尚未完成数据库配置，请联系管理员。'
      });
      results.push(error ? failed(item.id, error.code)
        : data === 'updated' || data === 'unchanged' ? {id: item.id, outcome: data} : failed(item.id));
    } catch {results.push(failed(item.id));}
  }
  return successResponse({results});
}
