import {describe, expect, it, vi} from 'vitest';
import {createAmapProxy} from '../../../lib/amap/security-proxy';

const key = 'mock-public-key';
const secret = 'mock-server-security-code';
const request = (path: string, headers?: HeadersInit) =>
  new Request('https://city.test/_AMapService/' + path, {headers: headers ?? {'Sec-Fetch-Site': 'same-origin'}});

describe('AMap security proxy', () => {
  it('accepts the loopback Host alias and normalizes the JS SDK keyword request', async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"status":"1"}'));
    const handler = createAmapProxy({key, secret, fetchUpstream: upstream});
    const response = await handler(new Request(
      'http://localhost:56544/_AMapService/v3/place/text?key=' + key +
      '&s=rsv3&csid=fixture&children=&type_=KEYWORD&antiCrab=true&s=rsv3&callback=amap_cb',
      {headers: {Host: '127.0.0.1:56544', Referer: 'http://127.0.0.1:56544/zh-CN/choose', 'Sec-Fetch-Site': 'same-origin'}}
    ));
    expect(response.status).toBe(200);
    const [upstreamUrl, options] = upstream.mock.calls[0];
    expect(new URL(String(upstreamUrl)).searchParams.getAll('s')).toEqual(['rsv3']);
    expect(options?.headers).toMatchObject({Referer: 'http://127.0.0.1:56544/'});
  });

  it('does not trust a non-loopback or different-port Host override', async () => {
    const upstream = vi.fn<typeof fetch>();
    const handler = createAmapProxy({key, secret, fetchUpstream: upstream});
    for (const host of ['outside.test:56544', '127.0.0.1:56545']) {
      const response = await handler(new Request('http://localhost:56544/_AMapService/v3/place/text?key=' + key,
        {headers: {Host: host, Origin: 'http://' + host, 'Sec-Fetch-Site': 'same-origin'}}));
      expect(response.status).toBe(403);
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it('forwards the single-route option sent by the JS Walking plugin', async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"status":"1"}'));
    const handler = createAmapProxy({key, secret, fetchUpstream: upstream});
    const walkingRequest = 'v3/direction/walking?key=' + key +
      '&platform=JS&s=rsv3&logversion=2.0&sdkversion=2.0&appname=city.test&csid=fixture' +
      '&origin=113.55,22.18&destination=113.56,22.18&multipath=0&s=rsv3&callback=amap_walk';

    const response = await handler(request(walkingRequest));

    expect(response.status).toBe(200);
    expect(new URL(String(upstream.mock.calls[0][0])).searchParams.get('multipath')).toBe('0');
    expect(await response.text()).toBe('amap_walk({"status":"1"});');
  });
  it('adds the security code only upstream and preserves SDK JSONP', async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"status":"1"}'));
    const handler = createAmapProxy({key, secret, fetchUpstream: upstream});
    const response = await handler(request('v3/place/text?key=' + key + '&keywords=test&callback=amap_cb'));
    const [url, options] = upstream.mock.calls[0];
    expect(String(url)).toContain('https://restapi.amap.com/v3/place/text?');
    expect(new URL(String(url)).searchParams.get('jscode')).toBe(secret);
    expect(options?.redirect).toBe('error');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('amap_cb({"status":"1"});');
  });

  it.each([
    [403, 'v3/place/text?key=' + key, {'Sec-Fetch-Site': 'cross-site'}],
    [403, 'v3/place/text?key=' + key, {Origin: 'https://foreign.test'}],
    [403, 'v3/place/text?key=' + key, {Referer: 'https://foreign.test/'}],
    [403, 'v3/place/text?key=' + key, {Referer: 'invalid'}],
    [404, 'v3/config/district?key=' + key],
    [404, 'v3/place/%74ext?key=' + key],
    [400, 'v3/place/text?key=wrong'],
    [400, 'v3/place/text?key=' + key + '&jscode=override'],
    [400, 'v3/place/text?key=' + key + '&key=' + key],
    [400, 'v3/place/text?key=' + key + '&callback=alert(1)'],
    [400, 'v3/place/text?key=' + key + '&keywords=%00'],
    [400, 'v3/place/text?key=' + key + '&offset=5000'],
    [400, 'v3/place/text?key=' + key + '&multipath=0'],
    [400, 'v3/direction/walking?key=' + key + '&multipath=1'],
    [400, 'v3/direction/walking?key=' + key + '&multipath=0&multipath=0'],
    [400, 'v3/place/text?key=' + key + '&keywords=' + 'a'.repeat(4096)],
  ] as const)('answers %i for a rejected request without forwarding', async (status, path, headers?: HeadersInit) => {
    const upstream = vi.fn<typeof fetch>();
    const handler = createAmapProxy({key, secret, fetchUpstream: upstream});
    expect((await handler(request(path, headers))).status).toBe(status);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('accepts a same-origin referer for browsers without fetch metadata', async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    const handler = createAmapProxy({key, secret, fetchUpstream: upstream});
    const response = await handler(request('v3/ip?key=' + key, {Referer: 'https://city.test/zh-CN'}));
    expect(response.status).toBe(200);
    expect(upstream.mock.calls[0][1]?.headers).toMatchObject({Referer: 'https://city.test/'});
  });

  it('rejects missing origin evidence, non-GET requests and missing configuration', async () => {
    const upstream = vi.fn<typeof fetch>();
    const handler = createAmapProxy({key, secret, fetchUpstream: upstream});
    const url = request('v3/place/text?key=' + key).url;
    expect((await handler(new Request(url))).status).toBe(403);
    expect((await handler(new Request(url, {method: 'POST'}))).status).toBe(405);
    expect((await createAmapProxy({key, fetchUpstream: upstream})(request('v3/place/text?key=' + key))).status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid JSON', '{'],
    ['JSONP supplied by upstream', 'callback({});'],
    ['non-object JSON', '"some string"'],
    ['oversized body', JSON.stringify({data: 'a'.repeat(2 * 1024 * 1024)})],
    ['reflected secret', JSON.stringify({echo: secret})],
    ['escaped reflected secret', '{"echo":"\\u006dock-server-security-code"}']
  ])('rejects %s without exposing the upstream body', async (_label, body) => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    const handler = createAmapProxy({key, secret, fetchUpstream: upstream});
    const response = await handler(request('v3/place/text?key=' + key));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({error: 'amap_proxy_error'});
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it.each(['headers', 'body'])('times out while waiting for upstream %s', async (stage) => {
    const upstream = vi.fn<typeof fetch>(async (_url, options) => {
      const signal = options!.signal!;
      if (stage === 'headers') {
        return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
      }
      return new Response(new ReadableStream({
        start(controller) {
          signal.addEventListener('abort', () => controller.error(signal.reason));
        }
      }));
    });
    const handler = createAmapProxy({key, secret, fetchUpstream: upstream, timeoutMs: 10});
    expect((await handler(request('v3/place/text?key=' + key))).status).toBe(504);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('bounds in-flight requests and releases slots on completion', async () => {
    let complete!: (response: Response) => void;
    const upstream = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }))
      .mockImplementation(async () => new Response('{}'));
    const handler = createAmapProxy({key, secret, fetchUpstream: upstream, maxInFlight: 1});
    const send = () => handler(request('v3/place/text?key=' + key));
    const active = send();
    expect((await send()).status).toBe(429);
    expect(upstream).toHaveBeenCalledTimes(1);
    complete(new Response('{}'));
    expect((await active).status).toBe(200);
    expect((await send()).status).toBe(200);
  });

  it('does not forward requests beyond the instance minute budget', async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    const handler = createAmapProxy({key, secret, fetchUpstream: upstream, requestsPerMinute: 1});
    const send = () => handler(request('v3/place/text?key=' + key));
    expect((await send()).status).toBe(200);
    const rejected = await send();
    expect(rejected.status).toBe(429);
    expect(Number(rejected.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(upstream).toHaveBeenCalledTimes(1);
  });
});
