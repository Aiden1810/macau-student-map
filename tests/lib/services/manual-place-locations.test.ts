import {describe, expect, it} from 'vitest';
import {placeSubmissionDraftSchema} from '../../../lib/domain/submission';
import {prepareSubmissionForSubmit} from '../../../lib/services/submissions';
import {prepareAdminPlaceInput} from '../../../lib/admin/place-editor';
import {mapCanonicalPlaceToShop} from '../../../lib/mappers/canonical-shop';
import {mergeLegacyAndCanonicalPlaces} from '../../../lib/data/canonical-places';

const draft = {name: '楼下烤冷面', categorySlug: 'food' as const, longitude: 113.55, latitude: 22.16,
  tagIds: ['00000000-0000-0000-0000-000000000109']};
const details = {source: 'manual' as const, businessForm: 'stall' as const, accuracy: 'approximate' as const,
  mobility: 'fixed' as const, description: ' 酒吧门口右侧的摊位 ', landmark: '附近酒吧', hours: '通常晚上，雨天不确定'};
const admin = {...draft, status: 'published', searchKeywords: []};

describe('manual location information across publication', () => {
  it('carries finding directions through submission and requires them only when submitting', () => {
    const input = placeSubmissionDraftSchema.parse({...draft, locationDetails: details});
    const row = prepareSubmissionForSubmit(input);
    expect(row.location_details).toMatchObject({description: '酒吧门口右侧的摊位', businessForm: 'stall', landmark: '附近酒吧'});
    const incomplete = placeSubmissionDraftSchema.parse({...draft, locationDetails: {...details, description: '  '}});
    expect(() => prepareSubmissionForSubmit(incomplete)).toThrow(/位置描述/);
  });
  it('rejects manual publication without directions but permits an incomplete admin draft', () => {
    expect(() => prepareAdminPlaceInput({...admin, locationDetails: {...details, description: null}})).toThrow(/位置描述/);
    expect(prepareAdminPlaceInput({...admin, status: 'draft', locationDetails: {...details, description: null}}).status).toBe('draft');
  });
  it('does not infer accurate coordinates or a storefront for existing records', () => {
    const value = prepareAdminPlaceInput({...admin, locationDetails: {}});
    expect(value.locationDetails).toMatchObject({source: 'unknown', accuracy: 'unknown', businessForm: 'unknown'});
    expect(() => placeSubmissionDraftSchema.parse({...draft, locationDetails: {...details, accuracy: 'made-up'}})).toThrow();
    expect(() => placeSubmissionDraftSchema.parse({...draft, locationDetails: {...details, isOpen: true}})).toThrow();
  });
  it('leaves omitted location details untouched for old editor clients', () => {
    expect(prepareAdminPlaceInput(admin)).not.toHaveProperty('locationDetails');
  });
  it('retains public location details when a canonical place also has a legacy row', () => {
    const shop = mapCanonicalPlaceToShop({id: 'stall', name: draft.name, address: null, category_slug: 'food',
      region: null, longitude: 113.55, latitude: 22.16, price_per_person: null, rating_average: null,
      review_count: 0, status: 'published', legacy_image_urls: [], location_details: details});
    expect(shop.locationDetails).toMatchObject({businessForm: 'stall', accuracy: 'approximate'});
    const [merged] = mergeLegacyAndCanonicalPlaces([{...shop, locationDetails: undefined}], [shop]);
    expect(merged.locationDetails?.description).toBe('酒吧门口右侧的摊位');
  });
});
