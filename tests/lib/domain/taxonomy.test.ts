import {describe, expect, it} from 'vitest';
import {
  PLACE_CATEGORIES,
  findTaxonomyTag,
  groupSelectedTags,
  resolveTagAlias
} from '../../../lib/domain/taxonomy';

describe('canonical taxonomy', () => {
  it('keeps the four product categories stable and separate from facets', () => {
    expect(PLACE_CATEGORIES.map((category) => category.slug)).toEqual([
      'food',
      'shopping',
      'entertainment',
      'service'
    ]);

    expect(PLACE_CATEGORIES.some((category) => category.slug === ('deal' as string))).toBe(false);
  });

  it.each(['汉堡', '漢堡', 'burger', 'BURGERS'])('resolves %s to the burger product tag', (query) => {
    expect(resolveTagAlias(query).map((tag) => tag.slug)).toContain('burger');
  });

  it('groups same-facet selections without discarding later tags', () => {
    expect(groupSelectedTags(['burger', 'fried-chicken'])).toMatchObject({
      product: ['burger', 'fried-chicken']
    });
  });

  it('preserves existing canonical UUIDs for backward compatibility', () => {
    expect(findTaxonomyTag('00000000-0000-0000-0000-000000000106')).toMatchObject({
      slug: 'japanese-cuisine',
      labelZhMO: '日料'
    });
  });

  it('ignores unknown and duplicate tag identifiers', () => {
    expect(groupSelectedTags(['burger', 'burger', 'not-a-real-tag'])).toMatchObject({
      product: ['burger']
    });
  });
});
