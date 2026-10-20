import {createAdminPlaceRoute} from '@/lib/admin/api';
import {postgresUuid, prepareAdminPlaceInput, publishEditedSubmissionSchema} from '@/lib/admin/place-editor';
import {parseJsonBody} from '@/lib/api/request';
import {errorResponse, successResponse} from '@/lib/api/result';
import {transferApprovedSubmissionMedia} from '@/lib/services/media';

export const POST = createAdminPlaceRoute(async (request, client, _auth, id) => {
  if (!postgresUuid.safeParse(id).success) return errorResponse({code: 'NOT_FOUND', status: 404, message: '投稿不存在'});
  const body = await parseJsonBody(request, publishEditedSubmissionSchema);
  if (!body.ok) return errorResponse(body.error);
  let place;
  try {place = prepareAdminPlaceInput(body.data.place);} catch (error) {
    return errorResponse({code: 'VALIDATION_ERROR', status: 422, message: error instanceof Error ? error.message : '请检查地点资料'});
  }
  if (place.status !== 'published') return errorResponse({code: 'VALIDATION_ERROR', status: 422, message: '审核通过时需要发布地点'});
  const {data, error} = await client.rpc('admin_publish_submission', {
    p_submission_id: id, p_expected_version: body.data.version, p_input: place, p_review_note: body.data.reviewNote
  });
  if (error) throw error;
  const mediaWarnings = await transferApprovedSubmissionMedia(client, id!, String(data));
  return successResponse({placeId: String(data), mediaWarnings});
});
