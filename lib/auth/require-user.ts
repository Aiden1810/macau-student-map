import {createClient} from '@supabase/supabase-js';
import {readBearerToken} from '../admin/request-auth';
import type {ApiErrorDescriptor} from '../api/result';

export type VerifiedUser = {
  id: string;
  email?: string | null;
};

export type UserLookup = (
  accessToken: string
) => Promise<{user: VerifiedUser | null; error: unknown | null}>;

export type UserAuthResult =
  | {ok: true; user: VerifiedUser; accessToken: string}
  | {ok: false; error: ApiErrorDescriptor};

function publicSupabaseConfig(): {url: string; key: string} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing public Supabase server configuration.');
  }

  return {url, key};
}
export function createAuthenticatedSupabaseClient(accessToken: string) {
  const {url, key} = publicSupabaseConfig();
  return createClient(url, key, {
    auth: {persistSession: false, autoRefreshToken: false},
    global: {headers: {Authorization: `Bearer ${accessToken}`}}
  });
}

const defaultUserLookup: UserLookup = async (accessToken) => {
  const client = createAuthenticatedSupabaseClient(accessToken);
  const {data, error} = await client.auth.getUser(accessToken);
  return {user: data.user, error};
};

export async function requireUser(
  request: Request,
  dependencies: {lookupUser: UserLookup} = {lookupUser: defaultUserLookup}
): Promise<UserAuthResult> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return {
      ok: false,
      error: {code: 'UNAUTHORIZED', message: 'Authentication is required.', status: 401}
    };
  }

  const {user, error} = await dependencies.lookupUser(accessToken);
  if (error || !user?.id) {
    return {
      ok: false,
      error: {code: 'UNAUTHORIZED', message: 'The session is invalid or expired.', status: 401}
    };
  }

  return {ok: true, user, accessToken};
}
