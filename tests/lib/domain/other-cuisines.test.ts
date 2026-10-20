import {describe, expect, it} from 'vitest';
import {findTaxonomyTag, resolveTagAlias} from '../../../lib/domain/taxonomy';
import {getLaunchTagOptions} from '../../../lib/domain/place-types';
import {getCanonicalTagsForAdminAndSubmit} from '../../../lib/tags/schema';
import {prepareSubmissionForSubmit} from '../../../lib/services/submissions';
import {prepareAdminPlaceInput} from '../../../lib/admin/place-editor';
import {rankCompatibilityPlaces} from '../../../lib/services/search-places';
import {normalizePlaceSearchRequest} from '../../../lib/domain/search';
import {filterFoodPlaces} from '../../../lib/search/food-filters';
import {mapCanonicalPlaceToShop} from '../../../lib/mappers/canonical-shop';

const cuisines = ['indian-cuisine', 'southeast-asian-cuisine', 'other-cuisine'];
const places = [
  {id: 'india', name: 'A', category: 'food', tags: ['印度菜']},
  {id: 'thai', name: 'B', category: 'food', tags: ['東南亞菜']},
  {id: 'other', name: 'C', category: 'food', tags: ['其他菜系']},
  {id: 'japan', name: 'D', category: 'food', tags: ['日料', '咖喱']}
];
describe('other cuisines across contribution, editing and discovery', () => {
  it('uses the same canonical identifiers in submission and admin catalogs', () => {
    const formIds = getCanonicalTagsForAdminAndSubmit().flatMap(group => group.options.map(tag => tag.tag_id));
    for (const slug of cuisines) {
      const tag = findTaxonomyTag(slug);
      expect(tag, slug).not.toBeNull();
      expect(formIds).toContain(tag!.id);
      expect(getLaunchTagOptions('food').map(tag => tag.id)).toContain(tag!.id);
    }
    expect(findTaxonomyTag('southeast-asian-cuisine')!.id).toBe('00000000-0000-0000-0000-000000000111');
    // Expanding a parent for search must never rewrite a saved generic label as every child.
    expect(resolveTagAlias('其他菜系').map(tag => tag.slug)).toEqual(['other-cuisine']);
  });
  it.each(['印度菜', '印度料理', 'Indian cuisine', 'Indian food'])('resolves %s without inferring cuisine from curry', query => {
    expect(resolveTagAlias(query).map(tag => tag.slug)).toContain('indian-cuisine');
    expect(resolveTagAlias('咖喱').map(tag => tag.slug)).not.toContain('indian-cuisine');
  });
  it.each(cuisines)('accepts %s in both write paths and rejects non-food use', slug => {
    const tag = findTaxonomyTag(slug);
    expect(tag).not.toBeNull();
    const input = {name: '餐厅', categorySlug: 'food' as const, longitude: 113.55, latitude: 22.16, tagIds: [tag!.id]};
    expect(prepareSubmissionForSubmit({...input,
      sourcePlaceId: null, address: null, region: null, pricePerPerson: null, notes: null, version: 1}).tag_ids).toEqual([tag!.id]);
    expect(prepareAdminPlaceInput(input).tagIds).toEqual([tag!.id]);
    expect(() => prepareAdminPlaceInput({...input, categorySlug: 'service'})).toThrow();
  });
  it('groups existing Southeast Asian places without confusing child cuisine filters', () => {
    expect(filterFoodPlaces(['other-cuisine'], places).map(place => place.id)).toEqual(['india', 'thai', 'other']);
    expect(filterFoodPlaces(['indian-cuisine'], places).map(place => place.id)).toEqual(['india']);
    expect(filterFoodPlaces(['southeast-asian-cuisine'], places).map(place => place.id)).toEqual(['thai']);
  });
  it('uses parent group semantics for both text search and explicit tag filters', () => {
    for (const request of [{query: '其他菜系'}, {tagIds: ['other-cuisine']}]) {
      expect(rankCompatibilityPlaces(normalizePlaceSearchRequest(request), places).map(hit => hit.item.id).sort()).toEqual(['india', 'other', 'thai']);
    }
    expect(rankCompatibilityPlaces(normalizePlaceSearchRequest({query: 'Indian food'}), places).map(hit => hit.item.id)).toEqual(['india']);
  });
  it('keeps the concrete cuisine and parent group visible on public shop surfaces', () => {
    const shop = mapCanonicalPlaceToShop({id: 'i', name: '印度餐厅', address: null, category_slug: 'food', region: null,
      longitude: 113.55, latitude: 22.16, price_per_person: null, rating_average: null, review_count: 0,
      status: 'published', legacy_image_urls: [], place_tags: [{tags: {id: 'indian-id', slug: 'indian-cuisine', label_zh_mo: '印度菜'}}]});
    expect(shop.tags).toEqual(['印度菜', '其他菜系']);
  });
});
