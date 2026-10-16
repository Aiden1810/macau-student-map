import {createAdminRoute} from '@/lib/admin/api';
import {pendingPlaceSubmissions} from '@/lib/admin/place-data';
import {postgresUuid} from '@/lib/admin/place-editor';
import {errorResponse, successResponse} from '@/lib/api/result';
import {transferApprovedSubmissionMedia} from '@/lib/services/media';

export const POST = createAdminRoute(async (_request, client, _auth, id) => {
  if (!postgresUuid.safeParse(id).success) return errorResponse({code: 'NOT_FOUND', status: 404, message: '地点不存在'});
  const submissions = await pendingPlaceSubmissions(client, id!);
  const results = [];
  for (const submissionId of submissions) results.push(...await transferApprovedSubmissionMedia(client, submissionId, id!));
  return successResponse({mediaWarnings: results});
});
