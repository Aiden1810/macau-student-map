import {describe, expect, it} from 'vitest';
import {parseDiscoveryUrlState, updateDiscoverySearchParams} from '../../../lib/search/url-state';

describe('discovery URL state', () => {
  it('parses a shareable query and selected filters', () => {
    expect(parseDiscoveryUrlState('?q=burger&category=food&tags=coffee%2Cmilk-tea')).toEqual({
      query: 'burger',
      category: 'food',
      tags: ['coffee', 'milk-tea']
    });
  });

  it('discards unsupported categories and excessive tags', () => {
    const tags = Array.from({length: 30}, (_, index) => `tag-${index}`).join(',');
    const state = parseDiscoveryUrlState(`?category=unknown&tags=${tags}`);
    expect(state.category).toBe('all');
    expect(state.tags).toHaveLength(20);
  });

  it('removes empty discovery parameters without deleting unrelated parameters', () => {
    const params = new URLSearchParams('campaign=campus&q=old');
    expect(
      updateDiscoverySearchParams(params, {query: '', category: 'all', tags: []}).toString()
    ).toBe('campaign=campus');
  });

  it('migrates a legacy Chinese tag in a shared URL to canonical slugs', () => {
    const state = parseDiscoveryUrlState(
      `?category=food&tags=${encodeURIComponent('汉堡 / 炸鸡')}`
    );

    expect(state.tags).toEqual(['burger', 'fried-chicken']);
  });
});
