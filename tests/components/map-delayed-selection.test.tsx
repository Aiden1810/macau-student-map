// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import MapPlaceholder from '../../components/MapPlaceholder';
import type {Shop} from '../../types/shop';

let host: HTMLDivElement;
let root: Root;
const shop: Shop = {
  id: 's1', name: '测试店', address: '澳门', imageUrls: [], type: '餐饮', category: 'food',
  coordinates: [113.6, 22.2], hasCoordinates: true, studentDiscount: null, tags: [], features: [],
  shopType: '正餐', ratingLabel: '暂无评分', rating: 0, reviews: 0, recommendStatus: 'neutral', status: 'verified',
};
type TestWindow = Window & {AMap?: unknown; __amapLoadingPromise?: unknown; __amapPlaceLoadingPromise?: unknown};
const testWindow = window as TestWindow;

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_AMAP_WEB_KEY', 'local-test-key');
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  window.matchMedia = vi.fn().mockReturnValue({matches: false});
  delete testWindow.AMap;
  delete testWindow.__amapLoadingPromise;
  delete testWindow.__amapPlaceLoadingPromise;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.querySelectorAll('script[data-amap="true"]').forEach(script => script.remove());
  delete testWindow.AMap;
  delete testWindow.__amapLoadingPromise;
  delete testWindow.__amapPlaceLoadingPromise;
  vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe('selection made while the map is loading', () => {
  it('places the selected marker and focuses the shop once the SDK is ready', async () => {
    const markerOptions: Array<{zIndex?: number; position: [number, number]}> = [];
    const move = vi.fn();
    const sdk = {
      plugin(_name: string, ready: () => void) {ready();},
      Map: class {
        addControl() {} on() {} destroy() {}
        getZoom() {return 14;}
        getCenter() {return {getLng: () => 113.54, getLat: () => 22.18};}
        setZoomAndCenter = move;
      },
      Marker: class {
        constructor(options: typeof markerOptions[number]) {markerOptions.push(options);}
        on() {} setMap() {}
      },
      Pixel: class {}, Scale: class {},
      MarkerCluster: class {setMap() {}},
    };
    await act(async () => root.render(<MapPlaceholder shops={[shop]} selectedShopId={shop.id}
      locateSignal={1} onSelectShop={() => {}} />));
    expect(move).not.toHaveBeenCalled();
    await act(async () => {
      testWindow.AMap = sdk;
      document.querySelector('script[data-amap="true"]')!.dispatchEvent(new Event('load'));
    });
    expect(markerOptions.some(options => options.zIndex === 320)).toBe(true);
    expect(move).toHaveBeenCalledWith(16, [113.6, 22.2], true, {duration: 800});
  });
});

describe('AMap JSAPI 2.0 cluster data', () => {
  it('passes coordinate points to the cluster and keeps the place pin interactive', async () => {
    const onSelect = vi.fn();
    const renderedMarkers: Array<{content: string; events: Record<string, () => void>}> = [];
    class Marker {
      content = '';
      events: Record<string, () => void> = {};
      constructor() {renderedMarkers.push(this);}
      on(event: string, callback: () => void) {this.events[event] = callback;}
      setMap() {}
      setContent(content: string) {this.content = content;}
      setOffset() {}
      setzIndex() {}
    }
    testWindow.AMap = {
      plugin(_name: string, ready: () => void) {ready();},
      Map: class {
        addControl() {} on() {} destroy() {} setZoomAndCenter() {}
        getZoom() {return 14;}
        getCenter() {return {getLng: () => 113.54, getLat: () => 22.18};}
      },
      Marker, Pixel: class {}, Scale: class {},
      MarkerCluster: class {
        constructor(_map: unknown, points: Array<{lnglat?: [number, number]}>, options: {
          renderMarker: (context: {marker: Marker; data: unknown[]}) => void;
        }) {
          if (!points.every(point => Array.isArray(point.lnglat))) {
            throw new Error('JSAPI 2.0 MarkerCluster requires points with lnglat');
          }
          for (const point of points) options.renderMarker({marker: new Marker(), data: [point]});
        }
        setMap() {}
      },
    };
    await act(async () => root.render(<MapPlaceholder shops={[shop]} selectedShopId={null} onSelectShop={onSelect} />));
    const placePin = renderedMarkers.find(marker => marker.content.includes('data-place-icon="restaurant"'));
    expect(placePin).toBeDefined();
    await act(async () => placePin!.events.click());
    expect(onSelect).toHaveBeenCalledWith('s1');
    await act(async () => placePin!.events.mouseover());
    expect(renderedMarkers).toHaveLength(2);
  });
});
