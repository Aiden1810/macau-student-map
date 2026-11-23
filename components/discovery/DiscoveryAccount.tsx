
'use client';

import type {Session} from '@supabase/supabase-js';
import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import {supabase} from '@/lib/supabase';

const DiscoveryAccount = createContext<Session | null | undefined>(undefined);
export const useDiscoveryAccount = () => useContext(DiscoveryAccount);

export function DiscoveryAccountProvider({children}: {children: ReactNode}) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    let current = true;
    let observed = false;
    const {data: listener} = supabase.auth.onAuthStateChange((_event, next) => {
      observed = true;
      setSession(next);
    });
    void supabase.auth.getSession().then(({data}) => {
      if (current && !observed) setSession(data.session);
    }).catch(() => {if (current && !observed) setSession(null);});
    return () => {current = false; listener.subscription.unsubscribe();};
  }, []);
  return <DiscoveryAccount.Provider value={session}>{children}</DiscoveryAccount.Provider>;
}
