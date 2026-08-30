import type {ApiErrorDescriptor} from '../api/result';
import {
  createAuthenticatedSupabaseClient,
  requireUser,
  type UserLookup,
  type VerifiedUser
} from './require-user';

export type RoleLookup = (
  userId: string,
  accessToken: string
) => Promise<{role: unknown; error: unknown | null}>;

export type AdminAuthResult =
  | {ok: true; user: VerifiedUser; accessToken: string; role: 'admin'}
  | {ok: false; error: ApiErrorDescriptor};

const defaultRoleLookup: RoleLookup = async (userId, accessToken) => {
  const client = createAuthenticatedSupabaseClient(accessToken);
  const {data, error} = await client.from('profiles').select('role').eq('id', userId).maybeSingle();
  return {role: data?.role, error};
};

export async function requireAdmin(
  request: Request,
  dependencies: {lookupUser: UserLookup; lookupRole: RoleLookup} = {
    lookupUser: async (accessToken) => {
      const client = createAuthenticatedSupabaseClient(accessToken);
      const {data, error} = await client.auth.getUser(accessToken);
      return {user: data.user, error};
    },
    lookupRole: defaultRoleLookup
  }
): Promise<AdminAuthResult> {
  const userResult = await requireUser(request, {lookupUser: dependencies.lookupUser});
  if (!userResult.ok) return userResult;

  const {role, error} = await dependencies.lookupRole(userResult.user.id, userResult.accessToken);
  if (error || role !== 'admin') {
    return {
      ok: false,
      error: {code: 'FORBIDDEN', message: 'Administrator permission is required.', status: 403}
    };
  }

  return {...userResult, role: 'admin'};
}
