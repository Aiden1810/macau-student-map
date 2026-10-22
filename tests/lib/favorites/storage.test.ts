import {describe, expect, it} from 'vitest';
import {
  FAVORITES_KEY, LEGACY_FAVORITES_KEY, claimGuestFavorites, favoriteStorageKey,
  pendingFavoritesKey, readFavoriteIds
} from '../../../lib/favorites/storage';

function storageFixture() {
  const values = new Map<string, string>();
  return {getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {values.set(key, value);}} as Storage;
}
describe('scoped favorite storage', () => {
  it('separates guest, legacy, and each account namespace', () => {
    expect(new Set([FAVORITES_KEY, LEGACY_FAVORITES_KEY, favoriteStorageKey('alice'), favoriteStorageKey('bob')]).size).toBe(4);
  });
  it('ignores malformed cache entries without inventing IDs', () => {
    const storage = storageFixture();
    storage.setItem(FAVORITES_KEY, JSON.stringify([null, {}, '', 123, 'valid', 'valid']));
    expect(readFavoriteIds(storage, FAVORITES_KEY)).toEqual(['valid']);
    storage.setItem(FAVORITES_KEY, '{broken');
    expect(readFavoriteIds(storage, FAVORITES_KEY)).toEqual([]);
  });
  it('does not upload guest data if browser storage cannot assign ownership', () => {
    const storage = storageFixture();
    storage.setItem(FAVORITES_KEY, JSON.stringify(['guest']));
    const write = storage.setItem;
    storage.setItem = (key, value) => {
      if (key === FAVORITES_KEY) throw new Error('quota');
      write(key, value);
    };
    expect(claimGuestFavorites(storage, 'alice')).toEqual([]);
    expect(readFavoriteIds(storage, pendingFavoritesKey('alice'))).toEqual([]);
    expect(readFavoriteIds(storage, FAVORITES_KEY)).toEqual(['guest']);
  });
});
