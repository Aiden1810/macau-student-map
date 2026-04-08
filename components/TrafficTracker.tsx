'use client';

import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {supabase} from '@/lib/supabase';

const SESSION_KEY = 'cityu_food_session_id';

function ensureSessionId(): string {
  if (typeof window === 'undefined') return '';

  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const next = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(SESSION_KEY, next);
  return next;
}

export default function TrafficTracker() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    const track = async () => {
      if (!pathname || typeof window === 'undefined') return;

      const sessionId = ensureSessionId();
      if (!sessionId) return;

      const locale = pathname.split('/').filter(Boolean)[0] ?? null;
      const referrer = document.referrer || null;
      const userAgent = navigator.userAgent || null;

      const {data: authData} = await supabase.auth.getUser();
      const userId = authData?.user?.id ?? null;

      if (cancelled) return;

      await supabase.from('site_traffic_events').insert({
        event_type: 'page_view',
        path: pathname,
        locale,
        session_id: sessionId,
        user_id: userId,
        user_agent: userAgent,
        referrer
      });
    };

    track();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
