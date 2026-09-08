import type {RequestGuard} from './async-request';

export type AuthRoleResult =
  | {isCurrent: true; signedOut: true; role: null}
  | {isCurrent: true; signedOut: false; role: string | null}
  | {isCurrent: false; signedOut: boolean; role: null};

export type GetCurrentUserId = () => Promise<string | null>;
export type ResolveRoleById = (userId: string) => Promise<{role: string | null; error: string | null}>;

/**
 * Resolve the signed-in user's role with stale-response protection.
 *
 * The role is only applied when the lambda returns `{isCurrent: true}`:
 * - the request is still the freshest one (nothing signed out / a newer check
 *   started in the meantime), and
 * - the user resolved by the profile query is the same user that started the
 *   query (re-checked after the DB call).
 *
 * When the session is (or becomes) empty the result reports `signedOut` so the
 * caller can clear any admin role immediately.
 */
export async function loadAuthRole(
  guard: RequestGuard,
  getUserId: GetCurrentUserId,
  resolveRole: ResolveRoleById
): Promise<AuthRoleResult> {
  const token = guard.begin();

  const userId = await getUserId();
  if (userId === null) {
    return guard.isCurrent(token)
      ? {isCurrent: true, signedOut: true, role: null}
      : {isCurrent: false, signedOut: true, role: null};
  }
  if (!guard.isCurrent(token)) {
    return {isCurrent: false, signedOut: false, role: null};
  }

  const {role, error} = await resolveRole(userId);
  if (error) {
    return guard.isCurrent(token)
      ? {isCurrent: true, signedOut: false, role: null}
      : {isCurrent: false, signedOut: false, role: null};
  }

  const currentUserId = await getUserId();
  if (!guard.isCurrent(token)) {
    return {isCurrent: false, signedOut: false, role: null};
  }
  if (currentUserId !== userId) {
    return currentUserId === null
      ? {isCurrent: true, signedOut: true, role: null}
      : {isCurrent: true, signedOut: false, role: null};
  }

  return {isCurrent: true, signedOut: false, role};
}