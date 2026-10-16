import {createAdminRoute} from '@/lib/admin/api';
import {loadSubmissionEditor} from '@/lib/admin/place-data';
import {postgresUuid} from '@/lib/admin/place-editor';
import {errorResponse, successResponse} from '@/lib/api/result';

export const GET = createAdminRoute(async (_request, client, _auth, id) => {
  if (!postgresUuid.safeParse(id).success) return errorResponse({code: 'NOT_FOUND', status: 404, message: '投稿不存在'});
  const submission = await loadSubmissionEditor(client, id!);
  return submission ? successResponse(submission) : errorResponse({code: 'CONFLICT', status: 409, message: '投稿不存在或已审核，请刷新队列'});
});
