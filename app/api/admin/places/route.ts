import {createAdminRoute} from '@/lib/admin/api';
import {ADMIN_PLACE_COLUMNS, mapAdminPlace} from '@/lib/admin/place-data';
import {adminPlaceSchema, prepareAdminPlaceInput} from '@/lib/admin/place-editor';
import {parseJsonBody} from '@/lib/api/request';
import {errorResponse, successResponse} from '@/lib/api/result';

export const GET = createAdminRoute<Record<string, never>>(async (_request, client) => {
  const {data, error} = await client.from('places').select(ADMIN_PLACE_COLUMNS).is('legacy_shop_id', null).order('updated_at', {ascending: false}).limit(500);
  if (error) throw error;
  const items = await Promise.all((data ?? []).map(row => mapAdminPlace(client, row as unknown as Parameters<typeof mapAdminPlace>[1])));
  return successResponse({items});
});

export const POST = createAdminRoute<Record<string, never>>(async (request, client) => {
  const body = await parseJsonBody(request, adminPlaceSchema);
  if (!body.ok) return errorResponse(body.error);
  let input;
  try {input = prepareAdminPlaceInput(body.data);} catch (error) {
    return errorResponse({code: 'VALIDATION_ERROR', status: 422, message: error instanceof Error ? error.message : '请检查地点资料'});
  }
  const {data, error} = await client.rpc('admin_save_place', {p_place_id: null, p_input: input});
  if (error) throw error;
  return successResponse({placeId: String(data)}, {status: 201});
});
