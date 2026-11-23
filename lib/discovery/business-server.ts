
import {createClient} from '@supabase/supabase-js';
import {requireUser, createAuthenticatedSupabaseClient} from '@/lib/auth/require-user';
import {DiscoveryError} from '@/lib/amap/discovery-provider';
import {queryAmap} from './server';
import type {PoiMetadata} from './business';
import type {SupabaseClient} from '@supabase/supabase-js';

export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new DiscoveryError('NOT_CONFIGURED', 503);
  return createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
}

export async function discoveryActor(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) throw new DiscoveryError('SIGN_IN', 401);
  return {id: auth.user.id, client: createAuthenticatedSupabaseClient(auth.accessToken)};
}

export async function verifyDiscoveryPoi(client: SupabaseClient, poiId: string, signal: AbortSignal) {
  if (process.env.AMAP_ALLOW_POI_ID_PERSISTENCE !== 'true') {
    throw new DiscoveryError('POI_PERSISTENCE_DISABLED', 503);
  }
  const {data, error} = await client.rpc('discovery_poi_metadata', {p_ids: [poiId]}).abortSignal(signal);
  if (error) throw error;
  const [location] = (data ?? []) as PoiMetadata[];
  if (location) {
    if (!location.available || !location.current_poi_id) throw new DiscoveryError('PLACE_UNAVAILABLE', 404);
    return;
  }
  // First write requires a fresh exact upstream match, not browser-supplied place data.
  const {items} = await queryAmap({kind: 'detail', id: poiId}, signal);
  if (items.length === 0) throw new DiscoveryError('PLACE_UNAVAILABLE', 404);
}
