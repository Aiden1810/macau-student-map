// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import NearbyPlaceSearch from '@/components/NearbyPlaceSearch';
import {searchAmapDiscoveryPlaces, type AmapPoiOption} from '@/lib/amap/place-search';

vi.mock('next-intl', () => ({useTranslations: () => (key: string) => key}));
vi.mock('@/lib/amap/place-search', () => ({searchAmapDiscoveryPlaces: vi.fn()}));

const place: AmapPoiOption = {
  placeId: 'external-poi', name: 'Campus Bistro', fullAddress: 'Taipa',
  coordinates: [113.55, 22.16], city: 'macau', distanceMeters: 120, distanceSource: 'map'
};
const mapCenter: [number, number] = [113.55, 22.17];
const onLocate = vi.fn();
const onClose = vi.fn();
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubEnv('NEXT_PUBLIC_AMAP_WEB_KEY', 'local-test-key');
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {this.open = true;}
  });
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function submit(value: 'city' | 'map') {
  const submitter = host.querySelector<HTMLButtonElement>(`button[value="${value}"]`)!;
  return act(async () => {
    host.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', {bubbles: true, cancelable: true, submitter}));
  });
}

describe('nearby search dialog', () => {
  it('waits for explicit search and locates a provider result with walking navigation', async () => {
    vi.mocked(searchAmapDiscoveryPlaces).mockResolvedValue([place]);
    await act(async () => root.render(<NearbyPlaceSearch open mapCenter={mapCenter} userCoordinates={null}
      onLocate={onLocate} onClose={onClose} />));

    expect(host.querySelector('dialog')?.open).toBe(true);
    expect(searchAmapDiscoveryPlaces).not.toHaveBeenCalled();
    expect(host.querySelector('button[value="user"]')).toBeNull();
    await submit('map');

    expect(searchAmapDiscoveryPlaces).toHaveBeenCalledWith('local-test-key', {
      city: 'macau', category: 'food', keyword: '', origin: {coordinates: mapCenter, source: 'map'}
    }, 'unnamed');
    expect(host.textContent).toContain('sourceHint');
    expect(host.textContent).toContain(place.name);
    expect(host.querySelector('a')?.href).toContain('mode=walk');
    const locate = [...host.querySelectorAll('button')].find(button => button.textContent === 'showOnMap');
    await act(async () => locate!.click());
    expect(onLocate).toHaveBeenCalledWith(place);
  });

  it('allows city search without coordinates and distinguishes failure from no matches', async () => {
    vi.mocked(searchAmapDiscoveryPlaces).mockRejectedValueOnce(new Error('provider unavailable')).mockResolvedValueOnce([]);
    await act(async () => root.render(<NearbyPlaceSearch open mapCenter={null} userCoordinates={null}
      onLocate={onLocate} onClose={onClose} />));

    expect(host.querySelector('button[value="map"]')).toBeNull();
    await submit('city');
    expect(host.querySelector('[role="status"]')?.textContent).toBe('error');
    await submit('city');
    expect(host.querySelector('[role="status"]')?.textContent).toBe('empty');
  });
});
