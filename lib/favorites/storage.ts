// The old shared cache has no reliable owner. Keep it untouched; account
// favorites are recovered from Supabase rather than importing another user.
export const LEGACY_FAVORITES_KEY = 'mz_food_favorites';
export const FAVORITES_KEY = 'mz_food_favorites:v2:guest';
export const favoriteStorageKey = (userId: string | null) =>
  userId ? `mz_food_favorites:v2:user:${userId}` : FAVORITES_KEY;
export const pendingFavoritesKey = (userId: string) => `${favoriteStorageKey(userId)}:pending`;

export function readFavoriteIds(storage: Pick<Storage, 'getItem'>, key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? '[]');
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0))]
      : [];
  } catch {
    return [];
  }
}

/** Claim guest saves for one account before any async request or account change. */
export function claimGuestFavorites(storage: Storage, userId: string): string[] {
  const key = pendingFavoritesKey(userId);
  const pending = readFavoriteIds(storage, key);
  const guest = readFavoriteIds(storage, FAVORITES_KEY);
  if (guest.length === 0) return pending;
  const claimed = [...new Set([...pending, ...guest])];
  try {
    storage.setItem(key, JSON.stringify(claimed));
    storage.setItem(FAVORITES_KEY, '[]');
    return claimed;
  } catch {
    // Do not upload a guest list that could not be claimed exclusively.
    try {storage.setItem(key, JSON.stringify(pending));} catch {}
    return pending;
  }
}

export function acknowledgeGuestFavorites(storage: Storage, userId: string, imported: string[]): void {
  const key = pendingFavoritesKey(userId);
  const completed = new Set(imported);
  storage.setItem(key, JSON.stringify(readFavoriteIds(storage, key).filter(id => !completed.has(id))));
}
