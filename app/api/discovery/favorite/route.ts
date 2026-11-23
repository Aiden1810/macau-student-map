
import {favoriteInput} from '@/lib/discovery/business';
import {discoveryActor, serviceClient, verifyDiscoveryPoi} from '@/lib/discovery/business-server';
import {crossSiteRequest, discoveryFailure, discoveryResponse} from '@/lib/discovery/server';

export async function POST(request: Request) {
  if (crossSiteRequest(request)) return discoveryResponse({error: 'FORBIDDEN'}, 403);
  try {
    const actor = await discoveryActor(request);
    const parsed = favoriteInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return discoveryResponse({error: 'INVALID_FAVORITE'}, 400);
    const {poiId, saved} = parsed.data;
    if (saved) await verifyDiscoveryPoi(actor.client, poiId, request.signal);
    const {data, error} = await serviceClient().rpc('save_verified_discovery_favorite', {
      p_actor: actor.id, p_poi: poiId, p_saved: saved
    }).abortSignal(AbortSignal.any([request.signal, AbortSignal.timeout(10000)]));
    if (error) throw error;
    return discoveryResponse({saved: data});
  } catch (error) {return discoveryFailure(error);}
}
