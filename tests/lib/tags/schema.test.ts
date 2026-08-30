import {describe, expect, it} from 'vitest';
import {
  findTagByName,
  getCanonicalTagsForAdminAndSubmit,
  migrateLegacyTagsForSubmission
} from '../../../lib/tags/schema';

describe('legacy tag compatibility adapter', () => {
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
      tagNames: ['漢堡', '炸雞']
    });
  });

  it('exposes non-food product tags without a second hard-coded catalog', () => {
    const allOptions = getCanonicalTagsForAdminAndSubmit().flatMap((group) => group.options);
    expect(allOptions.find((option) => option.tag_id === '00000000-0000-0000-0000-000000000601')).toMatchObject({
      tag_name: '服飾'
    });
  });
});
