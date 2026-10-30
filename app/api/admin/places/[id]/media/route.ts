import {createAdminPlaceRoute} from '@/lib/admin/api';
import {postgresUuid} from '@/lib/admin/place-editor';
import {errorResponse, successResponse} from '@/lib/api/result';
import {IMAGE_MIME_EXTENSIONS, validateImageUpload} from '@/lib/storage/object-path';
import {markTransferredSourceForCleanup} from '@/lib/services/media';

export const POST = createAdminPlaceRoute(async (request, client, auth, id) => {
  if (!postgresUuid.safeParse(id).success) return errorResponse({code: 'NOT_FOUND', status: 404, message: '地点不存在'});
  const {data: place, error: placeError} = await client.from('places').select('id,legacy_image_urls').eq('id', id).maybeSingle();
  if (placeError) throw placeError;
  if (!place) return errorResponse({code: 'NOT_FOUND', status: 404, message: '请先保存地点资料'});
  let form: FormData;
  try {form = await request.formData();} catch {
    return errorResponse({code: 'VALIDATION_ERROR', status: 422, message: '请使用图片上传表单'});
  }
  const file = form.get('file');
  if (!(file instanceof File)) return errorResponse({code: 'VALIDATION_ERROR', status: 422, message: '请选择图片'});
  let mime;
  try {mime = validateImageUpload(file);} catch {
    return errorResponse({code: 'VALIDATION_ERROR', status: 422, message: '图片需为 JPEG、PNG 或 WebP，且不超过 10 MB'});
  }
  const {count, error: countError} = await client.from('place_media').select('id', {count: 'exact', head: true})
    .eq('place_id', id).eq('lifecycle_status', 'ready');
  if (countError) throw countError;
  if ((count ?? 0) + (place.legacy_image_urls?.length ?? 0) >= 5) return errorResponse({code: 'VALIDATION_ERROR', status: 422, message: '每个地点最多 5 张图片'});
  const path = `${id}/${crypto.randomUUID()}.${IMAGE_MIME_EXTENSIONS[mime]}`;
  const {error: uploadError} = await client.storage.from('place-media').upload(path, file, {contentType: mime, upsert: false});
  if (uploadError) throw uploadError;
  const {data, error} = await client.from('place_media').insert({
    place_id: id, submission_id: null, uploaded_by: auth.user.id, bucket_id: 'place-media', storage_path: path,
    mime_type: mime, byte_size: file.size, sort_order: count ?? 0, lifecycle_status: 'ready'
  }).select('id,sort_order').single();
  if (error || !data) {
    await client.storage.from('place-media').remove([path]);
    throw error ?? new Error('图片关联失败');
  }
  return successResponse({id: data.id, url: client.storage.from('place-media').getPublicUrl(path).data.publicUrl, sortOrder: data.sort_order}, {status: 201});
});

export const DELETE = createAdminPlaceRoute(async (request, client, _auth, id) => {
  const mediaId = new URL(request.url).searchParams.get('mediaId');
  if (postgresUuid.safeParse(id).success && mediaId?.startsWith('legacy:')) {
    const url = mediaId.slice(7);
    if (!url || url.length > 4096) return errorResponse({code: 'VALIDATION_ERROR', status: 422, message: '图片地址不合法'});
    const {error} = await client.rpc('admin_remove_legacy_place_image', {p_place_id: id, p_url: url});
    if (error) throw error;
    return successResponse({deleted: true});
  }
  if (!id || !postgresUuid.safeParse(id).success || !postgresUuid.safeParse(mediaId).success) {
    return errorResponse({code: 'NOT_FOUND', status: 404, message: '图片不存在'});
  }
  const {data, error} = await client.from('place_media').select('id,bucket_id,storage_path').eq('id', mediaId).eq('place_id', id).maybeSingle();
  if (error) throw error;
  if (!data) return errorResponse({code: 'NOT_FOUND', status: 404, message: '图片不存在或不属于此地点'});
  await markTransferredSourceForCleanup(client, id, data.storage_path);
  const {error: storageError} = await client.storage.from(data.bucket_id).remove([data.storage_path]);
  if (storageError) throw storageError;
  const {error: deleteError} = await client.from('place_media').delete().eq('id', data.id).eq('place_id', id);
  if (deleteError) throw deleteError;
  return successResponse({deleted: true});
});
