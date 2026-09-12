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

  it.each([
    ['茶餐厅 / 冰室', ['cha-chaan-teng']],
    ['烧腊 / 快餐', ['fast-food']],
    ['粉面 / 粥店', ['chinese-cuisine']],
    ['汉堡 / 炸鸡', ['burger', 'fried-chicken']],
    ['火锅 / 焖锅', ['hot-pot']],
    ['烧烤 / 烤肉', ['barbecue']],
    ['粤菜 / 早茶', ['chinese-cuisine']],
    ['日韩料理', ['japanese-cuisine', 'korean-cuisine']],
    ['炸物 / 小食', ['snack']],
    ['牛杂 / 串串', ['snack']],
    ['葡挞 / 烘焙', ['bread']],
    ['柠茶 / 果汁', ['fruit-tea']],
    ['传统糖水', ['dessert']],
    ['西式甜品', ['dessert']],
    ['冰品 / 雪糕', ['dessert']],
    ['学生证折扣', ['student-discount']]
  ])('migrates the legacy filter %s to canonical slugs', (legacyLabel, expectedSlugs) => {
    expect(resolveTagAlias(legacyLabel).map((tag) => tag.slug)).toEqual(expectedSlugs);
  });

  it.each([
    ['理发美发', 'hair-salon'],
    ['维修服务', 'repair-service']
  ])('resolves the Simplified Chinese display label %s', (label, expectedSlug) => {
    expect(resolveTagAlias(label).map((tag) => tag.slug)).toContain(expectedSlug);
  });
});
