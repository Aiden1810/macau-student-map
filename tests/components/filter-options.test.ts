import {describe, expect, it} from 'vitest';
import {L2_TAGS} from '../../lib/search/filter-options';
import {findTaxonomyTag, getTaxonomyTagLabelZhCN} from '../../lib/domain/taxonomy';

const TAG_BACKED_CATEGORIES = [
  'food',
  'drink',
  'shopping',
  'entertainment',
  'service',
  'vibe',
  'deal'
] as const;

describe('public filter options', () => {
  it('uses thirteen independent canonical food tags with Simplified Chinese labels', () => {
    const foodOptions = L2_TAGS.food.flatMap((group) => group.options);

    expect(foodOptions.map((option) => [option.value, option.labelZhCN])).toEqual([
      ['cha-chaan-teng', '茶餐厅'],
      ['hot-pot', '火锅'],
      ['barbecue', '烧烤'],
      ['fast-food', '快餐'],
      ['chinese-cuisine', '中餐'],
      ['portuguese-cuisine', '葡国菜'],
      ['japanese-cuisine', '日料'],
      ['korean-cuisine', '韩餐'],
      ['southeast-asian-cuisine', '东南亚菜'],
      ['western-cuisine', '西餐'],
      ['burger', '汉堡'],
      ['fried-chicken', '炸鸡'],
      ['snack', '小食']
    ]);
  });

  it('uses canonical slugs for every tag-backed public filter', () => {
    const values = TAG_BACKED_CATEGORIES.flatMap((category) =>
      L2_TAGS[category].flatMap((group) => group.options.map((option) => option.value))
    );

    expect(values.length).toBeGreaterThan(0);
    expect(values.every((value) => findTaxonomyTag(value) !== null)).toBe(true);
  });

  it('uses the canonical Simplified Chinese label as the only display-label source', () => {
    const options = TAG_BACKED_CATEGORIES.flatMap((category) =>
      L2_TAGS[category].flatMap((group) => group.options)
    );

    expect(
      options.every((option) => option.labelZhCN === getTaxonomyTagLabelZhCN(option.value))
    ).toBe(true);
  });
});
