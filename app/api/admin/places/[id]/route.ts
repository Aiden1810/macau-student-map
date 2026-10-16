import {createAdminRoute} from '@/lib/admin/api';
import {loadAdminPlace} from '@/lib/admin/place-data';
import {adminPlaceSchema, postgresUuid, prepareAdminPlaceInput} from '@/lib/admin/place-editor';
import {parseJsonBody} from '@/lib/api/request';
import {errorResponse, successResponse} from '@/lib/api/result';

export const GET = createAdminRoute(async (_request, client, _auth, id) => {
  if (!postgresUuid.safeParse(id).success) return errorResponse({code: 'NOT_FOUND', status: 404, message: '地点不存在'});
  const place = await loadAdminPlace(client, id!);
  return place ? successResponse(place) : errorResponse({code: 'NOT_FOUND', status: 404, message: '地点不存在'});
});

export const PATCH = createAdminRoute(async (request, client, _auth, id) => {
  if (!postgresUuid.safeParse(id).success) return errorResponse({code: 'NOT_FOUND', status: 404, message: '地点不存在'});
  const {data: source, error: sourceError} = await client.from('places').select('legacy_shop_id').eq('id', id).maybeSingle();
  if (sourceError) throw sourceError;
  if (source?.legacy_shop_id) return errorResponse({code: 'CONFLICT', status: 409, message: '这是旧版资料，请从旧版店铺管理入口编辑'});
  const body = await parseJsonBody(request, adminPlaceSchema);
  if (!body.ok) return errorResponse(body.error);
  let input;
  try {input = prepareAdminPlaceInput(body.data);} catch (error) {
    return errorResponse({code: 'VALIDATION_ERROR', status: 422, message: error instanceof Error ? error.message : '请检查地点资料'});
  }
  const {data, error} = await client.rpc('admin_save_place', {p_place_id: id, p_input: input});
  if (error) throw error;
  return successResponse({placeId: String(data)});
});
