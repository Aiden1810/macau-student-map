import { useState, useEffect, useCallback } from 'react';

const FAVORITES_KEY = 'mz_food_favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (err) {
      console.warn('Could not load favorites from localStorage', err);
    }
    setIsLoaded(true);
  }, []);

  const toggleFavorite = useCallback((shopId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(shopId)
        ? prev.filter((id) => id !== shopId)
        : [...prev, shopId];
      
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch (err) {
        console.warn('Could not save favorites to localStorage', err);
      }
      return next;
    });
  }, []);

  return { favorites, toggleFavorite, isLoaded };
}
