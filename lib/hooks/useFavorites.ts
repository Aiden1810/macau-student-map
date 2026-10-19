import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {supabase} from '@/lib/supabase';

import {FAVORITES_KEY, persistFavoriteChange} from '@/lib/favorites/persistence';

function safeLoadLocal(): string[] {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map((id) => String(id)) : [];
  } catch (err) {
    console.warn('Could not load favorites from localStorage', err);
    return [];
  }
}

function safeSaveLocal(next: string[]) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('Could not save favorites to localStorage', err);
  }
}

export function useFavorites() {
  const t = useTranslations('Home.toast');
  const [favorites, setFavorites] = useState<string[]>([]);
  const favoritesRef = useRef<string[]>([]);
  const userIdRef = useRef<string | null>(null);
  const mountedRef = useRef(false);
  const pendingRef = useRef(new Set<string>());
  const commitFavorites = useCallback((next: string[]) => {
    favoritesRef.current = next;
    setFavorites(next);
  }, []);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    commitFavorites(safeLoadLocal());
    setIsLoaded(true);
    return () => {mountedRef.current = false;};
  }, [commitFavorites]);

  useEffect(() => {
    const syncUser = async () => {
      const {data, error} = await supabase.auth.getUser();
      if (error || !data?.user) {
        if (!mountedRef.current) return;
        userIdRef.current = null;
        setUserId(null);
        return;
      }
      if (!mountedRef.current) return;
      userIdRef.current = data.user.id;
      setUserId(data.user.id);
    };

    syncUser();

    const {data: authListener} = supabase.auth.onAuthStateChange(() => {
      syncUser();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const syncRemote = async () => {
      if (!userId) return;

      const local = safeLoadLocal();

      const {data, error} = await supabase
        .from('favorites')
        .select('shop_id')
        .eq('user_id', userId);

      if (error) {
        console.warn('Could not load favorites from Supabase', error.message);
        return;
      }

      const remote = (data ?? []).map((row) => String(row.shop_id));
      const merged = Array.from(new Set([...local, ...remote]));

      if (!mountedRef.current || userIdRef.current !== userId) return;
      commitFavorites(merged);
      safeSaveLocal(merged);

      const missingRemote = merged.filter((id) => !remote.includes(id));
      if (missingRemote.length > 0) {
        const rows = missingRemote.map((shopId) => ({user_id: userId, shop_id: shopId}));
        const {error: insertError} = await supabase.from('favorites').upsert(rows, {
          onConflict: 'user_id,shop_id',
          ignoreDuplicates: true
        });

        if (insertError) {
          console.warn('Could not sync local favorites to Supabase', insertError.message);
        }
      }
    };

    syncRemote();
  }, [userId, commitFavorites]);

  const toggleFavorite = useCallback(async (shopId: string, event?: {stopPropagation?: () => void}) => {
    event?.stopPropagation?.();
    if (!isLoaded || pendingRef.current.has(shopId)) return;
    pendingRef.current.add(shopId);
    const saved = !favoritesRef.current.includes(shopId);
    const toastId = `favorite-${shopId}`;
    const options = {id: toastId, position: 'top-center' as const, duration: 2000};
    const current = () => mountedRef.current && userIdRef.current === userId;
    if (userId) toast.loading(t('favoriteSaving'), {...options, duration: Infinity});
    try {
      const result = await persistFavoriteChange(shopId, saved, {
        read: () => favoritesRef.current,
        commit: commitFavorites,
        writeLocal: next => window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)),
        isCurrent: current,
        syncRemote: userId ? async () => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10000);
          try {
            const request = saved
              ? supabase.from('favorites').upsert({user_id: userId, shop_id: shopId}, {onConflict: 'user_id,shop_id'})
              : supabase.from('favorites').delete().eq('user_id', userId).eq('shop_id', shopId);
            const {error} = await request.abortSignal(controller.signal);
            if (error) throw error;
          } finally {clearTimeout(timer);}
        } : undefined,
      });
      if (!current() || result === 'cancelled') {toast.dismiss(toastId); return;}
      if (result === 'success') toast.success(t(saved ? 'favoriteSaved' : 'favoriteRemoved'), options);
      else toast.error(t(result === 'local_error' ? 'favoriteStorageFailed' : 'favoriteSaveFailed'), {...options, duration: 3500});
    } catch {
      if (current()) toast.error(t('favoriteSaveFailed'), {...options, duration: 3500});
      else toast.dismiss(toastId);
    } finally {pendingRef.current.delete(shopId);}
  }, [isLoaded, userId, commitFavorites, t]);

  const isAuthed = useMemo(() => Boolean(userId), [userId]);

  return {favorites, toggleFavorite, isLoaded, isAuthed};
}
