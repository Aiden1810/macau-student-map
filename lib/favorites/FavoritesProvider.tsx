'use client';

import {createContext, useContext, type ReactNode} from 'react';
import {useFavorites} from '@/lib/hooks/useFavorites';

const FavoritesContext = createContext<ReturnType<typeof useFavorites> | null>(null);

export function FavoritesProvider({children}: {children: ReactNode}) {
  const favorites = useFavorites();
  return <FavoritesContext.Provider value={favorites}>{children}</FavoritesContext.Provider>;
}

export function useSharedFavorites() {
  const favorites = useContext(FavoritesContext);
  if (!favorites) throw new Error('FavoritesProvider is required');
  return favorites;
}
