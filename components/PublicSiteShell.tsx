'use client';

import dynamic from 'next/dynamic';
import {useEffect, useState, type ReactNode} from 'react';
import {usePathname} from '@/i18n/navigation';
import GlobalAssistant from '@/components/assistant/GlobalAssistant';
import {FavoritesProvider} from '@/lib/favorites/FavoritesProvider';
import MainNavigation from './MainNavigation';

const DiscoveryPage = dynamic(() => import('./DiscoveryPage'));

export default function PublicSiteShell({children}: {children: ReactNode}) {
  const pathname = usePathname();
  const isDiscovery = pathname === '/';
  const [hasVisitedDiscovery, setHasVisitedDiscovery] = useState(isDiscovery);

  useEffect(() => {
    if (isDiscovery) setHasVisitedDiscovery(true);
  }, [isDiscovery]);

  if (/^\/(?:admin(?:\/|$|-login$)|auth\/callback(?:\/|$))/.test(pathname)) return children;

  return (
    <div className="min-h-dvh pb-[var(--main-nav-bottom)]">
      <MainNavigation pathname={pathname} />
      <FavoritesProvider>
        <GlobalAssistant>
          {(isDiscovery || hasVisitedDiscovery) &&
            <div id="discovery-view" hidden={!isDiscovery}>
              <DiscoveryPage active={isDiscovery} />
            </div>}
          {children}
        </GlobalAssistant>
      </FavoritesProvider>
    </div>
  );
}
