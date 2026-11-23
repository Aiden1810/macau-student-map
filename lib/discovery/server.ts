
import {DiscoveryError, createDiscoveryProvider} from '@/lib/amap/discovery-provider';

const provider = createDiscoveryProvider(process.env.AMAP_WEB_SERVICE_KEY?.trim());
let minute = -1;
let requests = 0;
let inFlight = 0;

export async function queryAmap(...args: Parameters<typeof provider>) {
  const now = Math.floor(Date.now() / 60000);
  if (now !== minute) {
    minute = now;
    requests = 0;
  }
  // Shared per Node instance. The deployment must also enforce an edge quota.
  if (inFlight >= 6 || requests >= 120) throw new DiscoveryError('QUOTA', 429);
  requests++;
  inFlight++;
  try {return await provider(...args);}
  finally {inFlight--;}
}

export function discoveryResponse(data: unknown, status = 200) {
  return Response.json(data, {status, headers: {
    'Cache-Control': 'no-store',
    ...(status === 429 ? {'Retry-After': '60'} : {})
  }});
}

export function discoveryFailure(error: unknown) {
  if (error instanceof DiscoveryError) return discoveryResponse({error: error.code}, error.status);
  return discoveryResponse({error: 'REQUEST_FAILED'}, 500);
}

export function crossSiteRequest(request: Request) {
  const site = request.headers.get('sec-fetch-site');
  const origin = request.headers.get('origin');
  return site === 'cross-site' || Boolean(origin && origin !== new URL(request.url).origin);
}
