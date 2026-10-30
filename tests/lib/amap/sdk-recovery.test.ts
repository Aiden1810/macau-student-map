// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {loadAmapPlaceSdk, searchAmapPoiOptions} from '../../../lib/amap/place-search';

type TestWindow = Window & {
  AMap?: unknown;
  __amapPlaceLoadingPromise?: unknown;
};
const testWindow = window as TestWindow;

beforeEach(() => {
  vi.useFakeTimers();
  delete testWindow.AMap;
  delete testWindow.__amapPlaceLoadingPromise;
});
afterEach(() => {
  document.querySelectorAll('script[data-amap="true"]').forEach(script => script.remove());
  delete testWindow.AMap;
  delete testWindow.__amapPlaceLoadingPromise;
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('AMap SDK recovery', () => {
  it('shares one script between simultaneous callers', async () => {
    const first = loadAmapPlaceSdk('local-test-key');
    const second = loadAmapPlaceSdk('local-test-key');
    expect(document.querySelectorAll('script[data-amap="true"]')).toHaveLength(1);
    const sdk = {plugin() {}};
    testWindow.AMap = sdk;
    document.querySelector('script[data-amap="true"]')!.dispatchEvent(new Event('load'));
    expect(await first).toBe(sdk);
    expect(await second).toBe(sdk);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('replaces a failed script so a later attempt can succeed', async () => {
    const first = loadAmapPlaceSdk('local-test-key');
    const firstFailure = first.catch(error => error);
    const failedScript = document.querySelector('script[data-amap="true"]')!;
    failedScript.dispatchEvent(new Event('error'));
    expect(await firstFailure).toBeInstanceOf(Error);

    const retry = loadAmapPlaceSdk('local-test-key');
    // Attach the rejection handler before assertions to keep a broken retry handled.
    const retryResult = retry.catch(error => error);
    const nextScript = document.querySelector('script[data-amap="true"]');
    expect(nextScript).not.toBe(failedScript);
    expect(failedScript.isConnected).toBe(false);
    const sdk = {plugin() {}};
    testWindow.AMap = sdk;
    nextScript!.dispatchEvent(new Event('load'));
    expect(await retryResult).toBe(sdk);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ends an SDK load that never fires an event and allows another attempt', async () => {
    let outcome: unknown;
    void loadAmapPlaceSdk('local-test-key').catch(error => {outcome = error;});
    const stalledScript = document.querySelector('script[data-amap="true"]')!;
    await vi.advanceTimersByTimeAsync(15000);
    expect(outcome).toBeInstanceOf(Error);
    expect(stalledScript.isConnected).toBe(false);
    const retry = loadAmapPlaceSdk('local-test-key');
    const sdk = {plugin() {}};
    testWindow.AMap = sdk;
    document.querySelector('script[data-amap="true"]')!.dispatchEvent(new Event('load'));
    expect(await retry).toBe(sdk);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('AMap POI search timeout', () => {
  it('rejects a missing provider callback and ignores its late response', async () => {
    let respond!: (status: string, result: unknown) => void;
    testWindow.AMap = {
      plugin(_name: string, ready: () => void) {ready();},
      PlaceSearch: class {
        search(_keyword: string, callback: typeof respond) {respond = callback;}
      },
    };
    let failure: unknown;
    void searchAmapPoiOptions('local-test-key', '测试店', '未命名', 'macau')
      .catch(error => {failure = error;});
    await vi.advanceTimersByTimeAsync(15000);
    expect(failure).toBeInstanceOf(Error);
    expect(vi.getTimerCount()).toBe(0);
    expect(() => respond('complete', {
      get poiList() {throw new Error('Late callback must be ignored');},
    })).not.toThrow();
  });

  it('clears the deadline when the provider returns a successful result', async () => {
    testWindow.AMap = {
      plugin(_name: string, ready: () => void) {ready();},
      PlaceSearch: class {
        search(_keyword: string, callback: (status: string, result: unknown) => void) {
          callback('complete', {info: 'OK', poiList: {pois: [
            {id: 'poi-1', name: '测试店', location: {lng: 113.55, lat: 22.2}},
          ]}});
        }
      },
    };
    const result = await searchAmapPoiOptions('local-test-key', '测试店', '未命名', 'macau');
    expect(result).toMatchObject([{placeId: 'poi-1'}]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
