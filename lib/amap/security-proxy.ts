const prefix = '/_AMapService/';
const paths = new Set([
  '/v3/place/text', '/v3/place/around', '/v3/place/detail',
  '/v3/geocode/geo', '/v3/geocode/regeo', '/v3/assistant/coordinate/convert',
  '/v3/direction/driving', '/v3/direction/walking', '/v3/direction/transit/integrated',
  '/v3/ip', '/v1/position', '/v4/position'
]);
const allowedParams = new Set([
  'key', 'callback', 'output', 'platform', 'logversion', 's', 'appname', 'sdkversion',
  'csid', 'type_', 'antiCrab',
  'keywords', 'types', 'city', 'citylimit', 'children', 'extensions', 'offset', 'page',
  'location', 'locations', 'radius', 'sortrule', 'id', 'address', 'coordsys', 'roadlevel',
  'origin', 'destination', 'originid', 'destinationid', 'cityd', 'strategy', 'nightflag',
  'date', 'time', 'waypoints', 'avoidpolygons', 'avoidroad', 'cartype', 'ferry',
  'ip', 'bts', 'nearbts', 'mmac', 'macs', 'network', 'accesstype', 'imei', 'cdma',
  'poitype', 'batch', 'homeorcorp'
]);
const numericLimits = new Map([
  ['page', [1, 100]],
  ['offset', [1, 50]],
  ['radius', [0, 50000]]
]);
const maxResponseBytes = 2 * 1024 * 1024;
const loopbackHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;

function requestOrigin(url: URL, host: string | null): string {
  // Next.js dev normalizes the internal URL to localhost even when the browser uses 127.0.0.1.
  if (url.protocol !== 'http:' || !loopbackHost.test(url.host) || !host || !loopbackHost.test(host))
    return url.origin;
  const browserUrl = URL.parse('http://' + host);
  return browserUrl?.port === url.port ? browserUrl.origin : url.origin;
}

async function readJson(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing response');
  const decoder = new TextDecoder();
  let length = 0;
  let body = '';
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxResponseBytes) throw new Error('Response too large');
      body += decoder.decode(value, {stream: true});
    }
    const json: unknown = JSON.parse(body + decoder.decode());
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('Expected a JSON object');
    return JSON.stringify(json);
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function createAmapProxy({
  key, secret, fetchUpstream = fetch, requestsPerMinute = 120, maxInFlight = 8, timeoutMs = 8000
}: {
  key?: string; secret?: string; fetchUpstream?: typeof fetch; requestsPerMinute?: number; maxInFlight?: number; timeoutMs?: number;
}) {
  let minute = -1;
  let requests = 0;
  let inFlight = 0;
  const reply = (body: string, status: number, contentType = 'application/json', retryAfter?: number) =>
    new Response(body, {status, headers: {
      'Cache-Control': 'no-store',
      ...(retryAfter ? {'Retry-After': String(retryAfter)} : {}),
      'Content-Type': contentType + '; charset=utf-8',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff'
    }});
  const fail = (status: number, retryAfter?: number) =>
    reply(JSON.stringify({error: 'amap_proxy_error'}), status, 'application/json', retryAfter);
  return async (request: Request) => {
    if (request.method !== 'GET') return fail(405);
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    const sameOrigin = requestOrigin(url, request.headers.get('host'));
    const site = request.headers.get('sec-fetch-site');
    const referer = request.headers.get('referer');
    const refererOrigin = referer && URL.canParse(referer) ? new URL(referer).origin : null;
    // Browser request metadata is a cross-site guard, not caller authentication.
    if ((origin && origin !== sameOrigin) || (referer && refererOrigin !== sameOrigin)
      || (site && site !== 'same-origin')
      || (!site && origin !== sameOrigin && refererOrigin !== sameOrigin)) return fail(403);
    const path = '/' + url.pathname.slice(prefix.length);
    if (!url.pathname.startsWith(prefix) || !paths.has(path)) return fail(404);
    if (!key || !secret) return fail(503);
    if (url.search.length > 4096 || url.searchParams.get('key') !== key) return fail(400);

    const upstream = new URL(path, 'https://restapi.amap.com');
    const seen = new Set<string>();
    const callback = url.searchParams.get('callback');
    if (callback !== null && !/^[A-Za-z_$][A-Za-z0-9_$]{0,79}$/.test(callback)) return fail(400);
    for (const [name, value] of url.searchParams) {
      // PlaceSearch repeats its fixed protocol selector in the request.
      if (name === 's' && value === 'rsv3' && upstream.searchParams.get(name) === value) continue;
      // AMap.Walking sends this option for its single-route request.
      const walkingOption = path === '/v3/direction/walking' && name === 'multipath' && value === '0';
      if ((!allowedParams.has(name) && !walkingOption) || seen.has(name) || /[\x00-\x1f\x7f]/.test(value)) return fail(400);
      const limits = numericLimits.get(name);
      if (limits && (!/^\d{1,5}$/.test(value) || Number(value) < limits[0] || Number(value) > limits[1])) {
        return fail(400);
      }
      seen.add(name);
      if (name !== 'callback' && name !== 'output') upstream.searchParams.set(name, value);
    }
    const currentMinute = Math.floor(Date.now() / 60000);
    if (currentMinute !== minute) {
      minute = currentMinute;
      requests = 0;
    }
    if (requests >= requestsPerMinute) return fail(429, 60 - Math.floor(Date.now() / 1000) % 60);
    if (inFlight >= maxInFlight) return fail(429, 1);
    if (request.signal.aborted) return fail(400);
    requests += 1;
    inFlight += 1;

    upstream.searchParams.set('output', 'JSON');
    upstream.searchParams.set('jscode', secret);
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = AbortSignal.any([timeout, request.signal]);
    try {
      const response = await fetchUpstream(upstream, {
        cache: 'no-store', redirect: 'error', signal,
        headers: {Accept: 'application/json', Referer: sameOrigin + '/'}
      });
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        return fail(502);
      }
      const json = await readJson(response);
      const body = callback ? callback + '(' + json + ');' : json;
      if (body.includes(secret) || body.includes(encodeURIComponent(secret))) return fail(502);
      return reply(body, 200, callback ? 'application/javascript' : 'application/json');
    } catch {
      return fail(timeout.aborted ? 504 : 502);
    } finally {
      inFlight -= 1;
    }
  };
}
