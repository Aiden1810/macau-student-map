import {describe, expect, it} from 'vitest';
import {parseDiscoveryUrlState, updateDiscoverySearchParams} from '../../../lib/search/url-state';

describe('discovery URL state', () => {
  it('migrates old recommendation links to the objective budget and recent filters', () => {
    const state = parseDiscoveryUrlState(`?category=review&tags=${encodeURIComponent('高性价比,本周新上,本周上新,强烈推荐')}`);
    expect(state.tags).toEqual(['budget-30', 'recent-7-days', '强烈推荐']);
  });
  it('keeps unrecognized recommendation values as strings', () => {
    expect(parseDiscoveryUrlState('?category=review&tags=constructor,__proto__').tags)
      .toEqual(['constructor', '__proto__']);
  });
  it('restores only the latest region from an old multi-region link', () => {
    const state = parseDiscoveryUrlState(`?category=region&tags=${encodeURIComponent('澳门半岛,香洲区')}`);
    expect(state.tags).toEqual(['香洲区']);
  });

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
