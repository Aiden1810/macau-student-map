import {useCallback, useEffect, useMemo, useState} from 'react';
import {supabase} from '@/lib/supabase';

const FAVORITES_KEY = 'mz_food_favorites';

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
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setFavorites(safeLoadLocal());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    const syncUser = async () => {
      const {data, error} = await supabase.auth.getUser();
      if (error || !data?.user) {
        setUserId(null);
        return;
      }
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

      setFavorites(merged);
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
  }, [userId]);

  const toggleFavorite = useCallback((shopId: string, event?: {stopPropagation?: () => void}) => {
    event?.stopPropagation?.();

    setFavorites((prev) => {
      const exists = prev.includes(shopId);
      const next = exists ? prev.filter((id) => id !== shopId) : [...prev, shopId];
      safeSaveLocal(next);

      if (userId) {
        if (exists) {
          supabase.from('favorites').delete().eq('user_id', userId).eq('shop_id', shopId).then(({error}) => {
            if (error) console.warn('Could not remove favorite from Supabase', error.message);
          });
        } else {
          supabase
            .from('favorites')
            .upsert({user_id: userId, shop_id: shopId}, {onConflict: 'user_id,shop_id'})
            .then(({error}) => {
              if (error) console.warn('Could not save favorite to Supabase', error.message);
            });
        }
      }

      return next;
    });
  }, [userId]);

  const isAuthed = useMemo(() => Boolean(userId), [userId]);

  return {favorites, toggleFavorite, isLoaded, isAuthed};
}
