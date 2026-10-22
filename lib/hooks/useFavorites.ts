import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {supabase} from '@/lib/supabase';

import {persistFavoriteChange} from '@/lib/favorites/persistence';
import {
  acknowledgeGuestFavorites, claimGuestFavorites, favoriteStorageKey, readFavoriteIds
} from '@/lib/favorites/storage';

function safeLoadLocal(userId: string | null): string[] {
  try {
    return readFavoriteIds(window.localStorage, favoriteStorageKey(userId));
  } catch (err) {
    console.warn('Could not load favorites from localStorage', err);
    return [];
  }
}

function safeSaveLocal(userId: string | null, next: string[]) {
  try {
    window.localStorage.setItem(favoriteStorageKey(userId), JSON.stringify(next));
  } catch (err) {
    console.warn('Could not save favorites to localStorage', err);
  }
}

export function useFavorites() {
  const t = useTranslations('Home.toast');
  const [favorites, setFavorites] = useState<string[]>([]);
  const favoritesRef = useRef<string[]>([]);
  const userIdRef = useRef<string | null | undefined>(undefined);
  const accountVersionRef = useRef(0);
  const loadedRef = useRef(false);
  const mountedRef = useRef(false);
  const pendingRef = useRef(new Set<string>());
  const commitFavorites = useCallback((next: string[]) => {
    favoritesRef.current = next;
    setFavorites(next);
  }, []);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    mountedRef.current = true;
    let disposed = false;
    let authRevision = 0;
    const applyUser = (nextUserId: string | null) => {
      if (disposed || userIdRef.current === nextUserId) return;
      userIdRef.current = nextUserId;
      accountVersionRef.current++;
      loadedRef.current = false;
      setIsLoaded(false);
      commitFavorites(safeLoadLocal(nextUserId));
      setUserId(nextUserId);
    };

    const initialRevision = authRevision;
    void supabase.auth.getUser().then(({data, error}) => {
      if (authRevision === initialRevision) applyUser(error ? null : data.user?.id ?? null);
    }).catch(() => {
      if (authRevision === initialRevision) applyUser(null);
    });
    // Read the supplied session synchronously: calling Auth again from this
    // callback can block Supabase's auth lock and lets old lookups win a race.
    const {data: authListener} = supabase.auth.onAuthStateChange((_event, session) => {
      authRevision++;
      applyUser(session?.user.id ?? null);
    });

    return () => {
      disposed = true;
      mountedRef.current = false;
      authListener.subscription.unsubscribe();
    };
  }, [commitFavorites]);

  useEffect(() => {
    if (userId === undefined) return;
    const version = accountVersionRef.current;
    const controller = new AbortController();
    const current = () => !controller.signal.aborted && mountedRef.current &&
      userIdRef.current === userId && accountVersionRef.current === version;
    let pending: string[] = [];
    if (userId) {
      try {pending = claimGuestFavorites(window.localStorage, userId);} catch {}
    }
    const syncRemote = async () => {
      try {
        if (!userId) return;
        const {data, error} = await supabase.from('favorites').select('shop_id')
          .eq('user_id', userId).abortSignal(controller.signal);
        if (!current()) return;
        if (error) throw error;
        const remote = (data ?? []).map(row => String(row.shop_id));
        let merged = remote;
        const missingRemote = pending.filter(id => !remote.includes(id));
        if (missingRemote.length > 0) {
          const rows = missingRemote.map(shopId => ({user_id: userId, shop_id: shopId}));
          const {error: insertError} = await supabase.from('favorites').upsert(rows, {
            onConflict: 'user_id,shop_id', ignoreDuplicates: true
          }).abortSignal(controller.signal);
          if (!current()) return;
          if (insertError) console.warn('Could not sync guest favorites to Supabase', insertError.message);
          else merged = [...new Set([...remote, ...pending])];
          if (insertError) pending = [];
        }
        if (!current()) return;
        // Account caches are a fallback, never an upload queue: merging them
        // would resurrect favorites removed from another device.
        commitFavorites(merged);
        safeSaveLocal(userId, merged);
        try {acknowledgeGuestFavorites(window.localStorage, userId, pending);} catch {}
      } catch (error) {
        if (current()) console.warn('Could not load favorites from Supabase', error);
      } finally {
        if (current()) {loadedRef.current = true; setIsLoaded(true);}
      }
    };
    // A timeout must release the UI even if the database request stalls.
    const timer = setTimeout(() => {
      if (current()) {loadedRef.current = true; setIsLoaded(true);}
      controller.abort();
    }, 10000);
    void syncRemote().finally(() => clearTimeout(timer));
    return () => {clearTimeout(timer); controller.abort();};
  }, [userId, commitFavorites]);

  const toggleFavorite = useCallback(async (shopId: string, event?: {stopPropagation?: () => void}) => {
    event?.stopPropagation?.();
    if (!loadedRef.current || userId === undefined || userIdRef.current !== userId) return;
    const version = accountVersionRef.current;
    const pendingKey = `${version}:${shopId}`;
    if (pendingRef.current.has(pendingKey)) return;
    pendingRef.current.add(pendingKey);
    const saved = !favoritesRef.current.includes(shopId);
    const toastId = `favorite-${shopId}`;
    const options = {id: toastId, position: 'top-center' as const, duration: 2000};
    const current = () => mountedRef.current && userIdRef.current === userId && accountVersionRef.current === version;
    if (userId) toast.loading(t('favoriteSaving'), {...options, duration: Infinity});
    try {
      const result = await persistFavoriteChange(shopId, saved, {
        read: () => favoritesRef.current,
        commit: commitFavorites,
        writeLocal: next => window.localStorage.setItem(favoriteStorageKey(userId), JSON.stringify(next)),
        isCurrent: current,
        syncRemote: userId ? async () => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10000);
          try {
            const request = saved
              ? supabase.from('favorites').upsert({user_id: userId, shop_id: shopId}, {onConflict: 'user_id,shop_id', ignoreDuplicates: true})
              : supabase.from('favorites').delete().eq('user_id', userId).eq('shop_id', shopId);
            const {error} = await request.abortSignal(controller.signal);
            if (error) throw error;
            // A manual save/removal supersedes a previously failed guest
            // import, so signing in again must not resurrect the old choice.
            try {acknowledgeGuestFavorites(window.localStorage, userId, [shopId]);} catch {}
          } finally {clearTimeout(timer);}
        } : undefined,
      });
      if (!current() || result === 'cancelled') {toast.dismiss(toastId); return;}
      if (result === 'success') toast.success(t(saved ? 'favoriteSaved' : 'favoriteRemoved'), options);
      else toast.error(t(result === 'local_error' ? 'favoriteStorageFailed' : 'favoriteSaveFailed'), {...options, duration: 3500});
    } catch {
      if (current()) toast.error(t('favoriteSaveFailed'), {...options, duration: 3500});
      else toast.dismiss(toastId);
    } finally {pendingRef.current.delete(pendingKey);}
  }, [userId, commitFavorites, t]);

  const isAuthed = useMemo(() => Boolean(userId), [userId]);

  return {favorites, toggleFavorite, isLoaded, isAuthed};
}
