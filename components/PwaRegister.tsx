'use client';

import {useEffect} from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', {scope: '/'});
      } catch {
        // ignore registration failures in unsupported environments
      }
    };

    register();
  }, []);

  return null;
}
