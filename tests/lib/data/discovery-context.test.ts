
import {describe, expect, it} from 'vitest';
import {mergeDiscoveryEntries} from '@/lib/discovery/catalog';
import {createLatestDiscoveryRequest} from '@/lib/discovery/latest-request';
import type {Poi} from '@/lib/discovery/search';

const poi: Poi = {id: 'B000000001', name: '同名餐厅', address: '', category: '', coordinates: [113.54, 22.18]};
const catalog = [{id: 'historical-uuid', name: poi.name, address: '', longitude: 113.542, latitude: 22.18, recommended: true}];
const mapped = {poi_id: poi.id, current_poi_id: poi.id, place_id: catalog[0].id, available: true, recommended: true};

describe('discovery result state', () => {
  it('shares one filtered result between map and list, and deduplicates by POI association only', () => {
    expect(mergeDiscoveryEntries([poi], catalog, [], null, false)).toHaveLength(2);
    expect(mergeDiscoveryEntries([poi], catalog, [mapped], null, false)).toMatchObject([
      {poiId: poi.id, shop: {id: catalog[0].id, studentRecommended: true}}
    ]);
    expect(mergeDiscoveryEntries([poi], catalog, [], null, true).map(entry => entry.shop.id)).toEqual([catalog[0].id]);
    expect(mergeDiscoveryEntries([poi], [], [{...mapped, available: false}], null, false)).toEqual([]);
  });

  it('suppresses duplicate requests, cancels old requests and ignores late completions', () => {
    const latest = createLatestDiscoveryRequest();
    const a = latest.begin('a')!;
    expect(latest.begin('a')).toBeNull();
    const b = latest.begin('b')!;
    expect(a.signal.aborted).toBe(true);
    expect(a.current()).toBe(false);
    a.finish();
    expect(b.current()).toBe(true);
    latest.cancel();
    expect(b.current()).toBe(false);
  });
});
