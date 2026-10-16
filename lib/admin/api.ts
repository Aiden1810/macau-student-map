import type {SupabaseClient} from '@supabase/supabase-js';
import {requireAdmin, type AdminAuthResult} from '../auth/require-admin';
import {createAuthenticatedSupabaseClient} from '../auth/require-user';
import {errorResponse} from '../api/result';

type Identity = Extract<AdminAuthResult, {ok: true}>;
type Operation = (request: Request, client: SupabaseClient, auth: Identity, id: string | null) => Promise<Response>;

export function createAdminRoute<Params extends Record<string, string> = {id: string}>(operation: Operation, dependencies = {
  authorize: requireAdmin, client: createAuthenticatedSupabaseClient
}) {
  return async (request: Request, context: {params: Promise<Params>}): Promise<Response> => {
    let response: Response;
    try {
      const auth = await dependencies.authorize(request);
      if (!auth.ok) response = errorResponse(auth.error);
      else response = await operation(request, dependencies.client(auth.accessToken), auth, (await context?.params)?.id ?? null);
    } catch (error) {
      const code = (error as {code?: string})?.code;
      const failure = code === '40001' || code === '23505'
        ? {code: 'CONFLICT' as const, status: 409, message: '资料已变更或已经审核，请刷新后重试。'}
        : code === '23514' || code === '22P02'
          ? {code: 'VALIDATION_ERROR' as const, status: 422, message: '地点类型、标签或字段不符合要求，请检查资料。'}
          : code === 'P0002'
            ? {code: 'NOT_FOUND' as const, status: 404, message: '地点或投稿不存在。'}
            : code === '42501'
              ? {code: 'FORBIDDEN' as const, status: 403, message: '需要管理员权限。'}
              : {code: 'INTERNAL_ERROR' as const, status: 500, message: '操作失败，请稍后重试。'};
      if (failure.status === 500) console.error('Admin operation failed:', error);
      response = errorResponse(failure);
    }
    response.headers.set('cache-control', 'private, no-store');
    return response;
  };
}
