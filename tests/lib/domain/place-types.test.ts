import {describe, expect, it} from 'vitest';
import {getPlacePresentation, matchesLaunchCategory, selectLaunchCategory, getLaunchTagOptions, formatPlacePrice} from '../../../lib/domain/place-types';
import {prepareSubmissionForSubmit} from '../../../lib/services/submissions';
import {findTaxonomyTag} from '../../../lib/domain/taxonomy';
import {parseDiscoveryUrlState, updateDiscoverySearchParams} from '../../../lib/search/url-state';

describe('shared launch categories', () => {
  it('uses a service-friendly price caption and does not lose zero prices', () => {
    expect(formatPlacePrice({category: 'food', tags: [], pricePerPerson: 60})).toBe('人均 MOP 60');
    expect(formatPlacePrice({category: 'service', tags: ['理发'], pricePerPerson: 80})).toBe('消费参考 MOP 80/人次');
    expect(formatPlacePrice({category: 'entertainment', tags: ['桌游'], pricePerPerson: 0})).toBe('免费');
    expect(formatPlacePrice({category: 'service', tags: [], pricePerPerson: null})).toBe('消费待补充');
  });
  it.each([
    ['food', [], 'food', 'restaurant'],
    ['service', ['理髮美髮'], 'hair-salon', 'scissors'],
    ['entertainment', ['酒吧'], 'bar', 'wine'],
    ['entertainment', ['桌游'], 'tabletop', 'dice'],
    ['entertainment', ['劇本殺'], 'tabletop', 'mystery']
  ])('maps %s / %j to the same filter and icon', (category, tags, launch, icon) => {
    const place = {category, tags: tags as string[]};
    expect(matchesLaunchCategory(place, launch)).toBe(true);
    expect(getPlacePresentation(place).icon).toBe(icon);
  });

  it('does not infer a bar from its name or the late-night scene tag', () => {
    const place = {category: 'food', name: '酒吧风味饭店', tags: ['深夜营业']};
    expect(matchesLaunchCategory(place, 'bar')).toBe(false);
    expect(getPlacePresentation(place).icon).toBe('restaurant');
  });

  it('keeps board games and murder mystery distinct regardless of tag order', () => {
    expect(getPlacePresentation({category: 'entertainment', tags: ['桌游']}).label).toBe('桌游');
    for (const tags of [['桌游', '剧本杀'], ['剧本杀', '桌游']]) {
      expect(getPlacePresentation({category: 'entertainment', tags}).icon).toBe('mystery');
    }
  });

  it('uses generic icons for existing non-launch categories', () => {
    expect(getPlacePresentation({category: 'service', tags: ['打印']}).icon).toBe('service');
    expect(getPlacePresentation({category: 'shopping', tags: []}).icon).toBe('shop');
    expect(matchesLaunchCategory({category: 'entertainment', tags: ['电影院']}, 'tabletop')).toBe(false);
  });

  it('switching type removes conflicting primary tags but preserves scene tags', () => {
    expect(selectLaunchCategory('hair-salon', ['00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000406'])).toEqual({
      category: 'service', tagIds: ['00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000902']
    });
    expect(selectLaunchCategory('tabletop', []).tagIds).toEqual([]);
    expect(getLaunchTagOptions('tabletop').map(tag => tag.slug)).toEqual(['board-games', 'murder-mystery']);
  });

  it.each(['hair-salon', 'bar', 'tabletop'])('preserves the %s filter through URL refresh', (category) => {
    const parsed = parseDiscoveryUrlState(`category=${category}`);
    expect(parsed.category).toBe(category);
    expect(updateDiscoverySearchParams(new URLSearchParams(), parsed).get('category')).toBe(category);
  });

  it.each(['bar', 'murder-mystery'])('allows a real %s tag in an entertainment submission', (slug) => {
    const tag = findTaxonomyTag(slug);
    expect(tag).not.toBeNull();
    const input = {name: '测试地点', address: null, sourcePlaceId: null, categorySlug: 'entertainment' as const, region: null, longitude: 113.55, latitude: 22.16, pricePerPerson: null, tagIds: [tag!.id], notes: null, version: 1};
    expect(prepareSubmissionForSubmit(input).tag_ids).toEqual([tag!.id]);
    expect(() => prepareSubmissionForSubmit({...input, categorySlug: 'food'})).toThrow(/category/i);
  });

  it('does not accept only a scene tag as a place type', () => {
    expect(() => prepareSubmissionForSubmit({name: '测试地点', address: null, sourcePlaceId: null, categorySlug: 'service', region: null, longitude: 113.55, latitude: 22.16, pricePerPerson: null, tagIds: ['00000000-0000-0000-0000-000000000406'], notes: null, version: 1})).toThrow(/primary|type/i);
  });
});
