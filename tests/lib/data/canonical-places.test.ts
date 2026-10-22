import {describe, expect, it, vi} from 'vitest';
import type {Shop} from '../../../types/shop';
import {loadCanonicalPlaces, mergeLegacyAndCanonicalPlaces} from '../../../lib/data/canonical-places';

const shopA = {id: 'canonical-1', name: '新店A'} as unknown as Shop;

describe('loadCanonicalPlaces', () => {
  it('keeps legacy presentation while retaining the canonical first publication for duplicate ids', () => {
    const legacy = {id: 'shared', name: '旧资料', publishedAt: null, rating: 2, reviews: 1,
      ratingLabel: '还行吧', recommendStatus: 'neutral'} as Shop;
    const canonical = {...legacy, name: '新资料', publishedAt: '2026-10-18T10:00:00Z'} as Shop;
    expect(mergeLegacyAndCanonicalPlaces([legacy], [canonical, shopA]))
      .toEqual([{...legacy, publishedAt: canonical.publishedAt}, shopA]);
    expect(legacy.publishedAt).toBeNull();
    expect(mergeLegacyAndCanonicalPlaces([legacy], [])).toEqual([legacy]);
  });
  it('uses current review aggregates and confidence labels without replacing legacy presentation', () => {
    const legacy = {id: 'shared', name: '旧资料', imageUrls: ['original.jpg'], rating: 2, reviews: 1,
      ratingLabel: '还行吧', recommendStatus: 'neutral'} as Shop;
    const canonical = {...legacy, name: '新资料', rating: 4.9, reviews: 8,
      ratingLabel: '封神之作', recommendStatus: 'recommend'} as Shop;
    expect(mergeLegacyAndCanonicalPlaces([legacy], [canonical])[0]).toMatchObject({
      name: '旧资料', imageUrls: ['original.jpg'], rating: 4.9, reviews: 8,
      ratingLabel: '封神之作', recommendStatus: 'recommend'
    });
    expect(legacy.rating).toBe(2);
    const cleared = {...canonical, rating: 0, reviews: 0, ratingLabel: '暂无评分', recommendStatus: 'neutral'} as Shop;
    expect(mergeLegacyAndCanonicalPlaces([legacy], [cleared])[0]).toMatchObject({
      rating: 0, reviews: 0, ratingLabel: '暂无评分', recommendStatus: 'neutral'
    });
  });
  it('returns the items when the payload is ok', async () => {
    const loader = vi.fn(async () => ({ok: true, items: [shopA]}));

    const result = await loadCanonicalPlaces(loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(result).toEqual([shopA]);
  });

  it('returns an empty list when the payload is not ok', async () => {
    const loader = vi.fn(async () => ({ok: false, items: [shopA]}));

    const result = await loadCanonicalPlaces(loader);

    expect(result).toEqual([]);
  });

  it('returns an empty list when the loader rejects', async () => {
    const loader = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    const result = await loadCanonicalPlaces(loader);

    expect(result).toEqual([]);
  });
});
