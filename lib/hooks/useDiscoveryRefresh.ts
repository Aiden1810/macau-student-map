import {useEffect, useRef} from 'react';

/** Refresh on return/reconnect, without keeping a socket open or polling in the background. */
export function useDiscoveryRefresh(refresh: () => Promise<void>) {
  const refreshRef = useRef(refresh);
  useEffect(() => {refreshRef.current = refresh;}, [refresh]);

  useEffect(() => {
    let lastAttempt = Date.now();
    let pending = false;
    const onReturn = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine || pending || Date.now() - lastAttempt < 60000) return;
      lastAttempt = Date.now();
      pending = true;
      void (async () => {
        try {await refreshRef.current();} catch {
          // A failed automatic refresh waits for a later user event; no retry loop.
        } finally {pending = false;}
      })();
    };
    window.addEventListener('focus', onReturn);
    window.addEventListener('online', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      window.removeEventListener('online', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, []);
}
