
import {discoveryQuery} from '@/lib/discovery/search';
import {crossSiteRequest, discoveryFailure, discoveryResponse, queryAmap} from '@/lib/discovery/server';

export async function POST(request: Request) {
  if (crossSiteRequest(request)) return discoveryResponse({error: 'FORBIDDEN'}, 403);
  const parsed = discoveryQuery.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return discoveryResponse({error: 'INVALID_SEARCH'}, 400);
  try {return discoveryResponse(await queryAmap(parsed.data, request.signal));}
  catch (error) {return discoveryFailure(error);}
}
