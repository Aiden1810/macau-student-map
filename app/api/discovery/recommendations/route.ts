
import {DiscoveryError} from '@/lib/amap/discovery-provider';
import {recommendationInput, targetArgs} from '@/lib/discovery/business';
import {discoveryActor, serviceClient, verifyDiscoveryPoi} from '@/lib/discovery/business-server';
import {crossSiteRequest, discoveryFailure, discoveryResponse} from '@/lib/discovery/server';

export async function POST(request: Request) {
  if (crossSiteRequest(request)) return discoveryResponse({error: 'FORBIDDEN'}, 403);
  try {
    const actor = await discoveryActor(request);
    const parsed = recommendationInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return discoveryResponse({error: 'INVALID_RECOMMENDATION'}, 400);
    const input = parsed.data;
    const target = targetArgs(input.target);
    if (target.p_poi) await verifyDiscoveryPoi(actor.client, target.p_poi, request.signal);
    const client = serviceClient();
    if (new URL(request.url).searchParams.get('validate') === 'true') {
      if (target.p_place) {
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(5000)]);
        const {data, error} = await actor.client.from('places').select('id')
          .eq('id', target.p_place).eq('status', 'published').abortSignal(signal).maybeSingle();
        if (error) throw error;
        if (!data) throw new DiscoveryError('PLACE_UNAVAILABLE', 404);
      }
      return discoveryResponse({valid: true});
    }
    const {data, error} = await client.rpc('submit_student_recommendation', {
      ...target, p_actor: actor.id, p_id: input.id, p_reason: input.reason, p_dishes: input.dishes || null,
      p_amount: input.spending?.amount ?? null, p_currency: input.spending?.currency ?? null,
      p_amount_kind: input.spending?.kind ?? null, p_scene: input.scene || null, p_has_image: input.hasImage
    }).abortSignal(AbortSignal.any([request.signal, AbortSignal.timeout(10000)]));
    if (error) throw error;
    return discoveryResponse({id: data}, 201);
  } catch (error) {return discoveryFailure(error);}
}
