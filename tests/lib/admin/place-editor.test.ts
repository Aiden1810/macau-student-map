import {describe, expect, it} from 'vitest';
import {prepareAdminPlaceInput} from '../../../lib/admin/place-editor';

const input = {
  name: ' 校园火锅 ', nameEn: ' ', address: '氹仔', categorySlug: 'food',
  region: 'taipa', longitude: 113.56, latitude: 22.16, pricePerPerson: 80,
  tagIds: ['00000000-0000-0000-0000-000000000104'],
  searchKeywords: [' 好吃 ', '好吃', '聚餐首选'], status: 'published'
};

describe('admin place editor contract', () => {
  it('normalizes searchable keywords and preserves missing optional facts', () => {
    const result = prepareAdminPlaceInput(input);
    expect(result.name).toBe('校园火锅');
    expect(result.nameEn).toBeNull();
    expect(result.searchKeywords).toEqual(['好吃', '聚餐首选']);
    expect(prepareAdminPlaceInput({...input, pricePerPerson: null}).pricePerPerson).toBeNull();
  });
  it('rejects a restaurant tagged as a hair salon', () => {
    expect(() => prepareAdminPlaceInput({...input, categorySlug: 'service'})).toThrow();
  });
  it('rejects publishing without a real map location', () => {
    expect(() => prepareAdminPlaceInput({...input, longitude: null, latitude: null})).toThrow();
    expect(() => prepareAdminPlaceInput({...input, longitude: 0, latitude: 0})).toThrow();
  });
  it('does not allow the editorial form to overwrite user rating statistics', () => {
    expect(() => prepareAdminPlaceInput({...input, rating_average: 5})).toThrow();
  });
  it('rejects unknown tags and excessive keywords', () => {
    expect(() => prepareAdminPlaceInput({...input, tagIds: ['not-a-tag']})).toThrow();
    expect(() => prepareAdminPlaceInput({...input, searchKeywords: Array.from({length: 9}, (_, i) => `词${i}`)})).toThrow();
  });
});
