export {FAVORITES_KEY} from './storage';
type FavoritePersistence = {
  read: () => string[];
  writeLocal: (next: string[]) => void;
  commit: (next: string[]) => void;
  syncRemote?: () => Promise<void>;
  isCurrent?: () => boolean;
};

/** An account save is authoritative; anonymous changes require browser storage. */
export async function persistFavoriteChange(
  shopId: string, saved: boolean, deps: FavoritePersistence,
): Promise<'success' | 'local_error' | 'remote_error' | 'cancelled'> {
  if (deps.syncRemote) {
    try {await deps.syncRemote();}
    catch {return 'remote_error';}
  }
  if (deps.isCurrent && !deps.isCurrent()) return 'cancelled';
  // Read after the request completes so concurrent saves retain other shops.
  const next = deps.read().filter(id => id !== shopId);
  if (saved) next.push(shopId);
  try {deps.writeLocal(next);}
  catch {if (!deps.syncRemote) return 'local_error';}
  deps.commit(next);
  return 'success';
}
