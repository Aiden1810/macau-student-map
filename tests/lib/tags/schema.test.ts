import {describe, expect, it} from 'vitest';
import {
  findTagByName,
  getCanonicalTagsForAdminAndSubmit,
  migrateLegacyTagsForSubmission,
  toggleLegacyCanonicalTag
} from '../../../lib/tags/schema';

describe('legacy tag compatibility adapter', () => {
  it('deselects aliases by canonical identity and preserves other combined tags', () => {
    expect(toggleLegacyCanonicalTag(['泰餐'], '00000000-0000-0000-0000-000000000111')).toEqual([]);
    expect(toggleLegacyCanonicalTag(['日韩料理', '牛腩'], '00000000-0000-0000-0000-000000000106')).toEqual(['韩餐', '牛腩']);
  });
  it('uses the canonical catalog for traditional, simplified, and English aliases', () => {
    const ids = ['漢堡', '汉堡', 'burger'].map((value) => findTagByName(value)?.tag_id);
    expect(new Set(ids)).toEqual(new Set(['00000000-0000-0000-0000-000000000501']));
  });

  it('migrates a legacy combined label to every intended canonical tag', () => {
    expect(migrateLegacyTagsForSubmission(['汉堡 / 炸鸡'])).toEqual({
      tagIds: [
        '00000000-0000-0000-0000-000000000501',
        '00000000-0000-0000-0000-000000000502'
      ],
      tagNames: ['汉堡', '炸鸡']
    });
  });

  it('exposes non-food product tags without a second hard-coded catalog', () => {
    const allOptions = getCanonicalTagsForAdminAndSubmit().flatMap((group) => group.options);
    expect(allOptions.find((option) => option.tag_id === '00000000-0000-0000-0000-000000000601')).toMatchObject({
      tag_name: '服饰'
    });
  });
});
