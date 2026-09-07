import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {describe, expect, it, vi} from 'vitest';

type WorkerEvent = {
  request?: Request;
  respondWith?: (response: Promise<Response>) => void;
  waitUntil?: (work: Promise<unknown>) => void;
};

async function loadServiceWorker(options?: {
  cachedApiResponse?: Response;
  cacheKeys?: string[];
}) {
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const deleteCache = vi.fn(async () => true);
  const put = vi.fn(async () => undefined);
  const match = vi.fn(async () => options?.cachedApiResponse?.clone());
  const fetchFromNetwork = vi.fn(async () => Response.json({items: ['fresh']}));

  const source = await readFile(new URL('../../public/sw.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, {
    URL,
    Promise,
    fetch: fetchFromNetwork,
    caches: {
      keys: async () => options?.cacheKeys ?? [],
      delete: deleteCache,
      match,
      open: async () => ({
        addAll: async () => undefined,
        put
      })
    },
    self: {
      location: {origin: 'https://www.aiden-macau-map.top'},
      clients: {claim: async () => undefined},
      skipWaiting: () => undefined,
      addEventListener: (type: string, listener: (event: WorkerEvent) => void) => {
        listeners.set(type, listener);
      }
    }
  });

  return {listeners, deleteCache, fetchFromNetwork, match, put};
}

describe('public/sw.js', () => {
  it('always loads same-origin API GET requests from the network instead of a stale runtime cache', async () => {
    const worker = await loadServiceWorker({
      cachedApiResponse: Response.json({items: []})
    });
    let responsePromise: Promise<Response> | undefined;

    worker.listeners.get('fetch')?.({
      request: new Request('https://www.aiden-macau-map.top/api/places'),
      respondWith: (response) => {
        responsePromise = response;
      }
    });

    const response = await responsePromise;
    expect(await response?.json()).toEqual({items: ['fresh']});
    expect(worker.fetchFromNetwork).toHaveBeenCalledWith(
      expect.objectContaining({url: 'https://www.aiden-macau-map.top/api/places'}),
      {cache: 'no-store'}
    );
    expect(worker.match).not.toHaveBeenCalled();
    expect(worker.put).not.toHaveBeenCalled();
  });

  it('removes the previous runtime cache when the updated worker activates', async () => {
    const worker = await loadServiceWorker({
      cacheKeys: ['app-shell-macau-pulse-v2', 'runtime-macau-pulse-v2']
    });
    let activation: Promise<unknown> | undefined;

    worker.listeners.get('activate')?.({
      waitUntil: (work) => {
        activation = work;
      }
    });

    await activation;
    expect(worker.deleteCache).toHaveBeenCalledWith('app-shell-macau-pulse-v2');
    expect(worker.deleteCache).toHaveBeenCalledWith('runtime-macau-pulse-v2');
  });
});
