'use client';

import {useEffect, useState} from 'react';
import {searchNearbyBusinesses, type AmapPoiOption} from '@/lib/amap/place-search';

const empty: AmapPoiOption[] = [];
type Completed = {key: string; items: AmapPoiOption[]; partial: boolean; failed: boolean};

export function useNearbyBusinesses(
  enabled: boolean, center: [number, number] | null, zoom: number, unnamed: string, keyword = '', diningType = '050000'
) {
  const [last, setLast] = useState<Completed | null>(null);
  const [attempt, setAttempt] = useState(0);
  const hasCenter = Boolean(center && Number.isFinite(center[0]) && Number.isFinite(center[1]));
  const longitude = hasCenter && center ? Math.round(center[0] / 0.002) * 0.002 : null;
  const latitude = hasCenter && center ? Math.round(center[1] / 0.002) * 0.002 : null;
  const key = hasCenter && zoom >= 13 ? JSON.stringify(['all', longitude, latitude, keyword, diningType, attempt]) : null;
  const current = last?.key === key ? last : null;

  useEffect(() => {
    if (!enabled || !key || current || longitude === null || latitude === null) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void searchNearbyBusinesses(process.env.NEXT_PUBLIC_AMAP_WEB_KEY ?? '', 'all',
        [longitude, latitude], unnamed, controller.signal, keyword, diningType)
        .then(result => {
          if (!controller.signal.aborted) setLast({key, ...result, failed: false});
        }).catch(() => {
          if (!controller.signal.aborted) setLast({key, items: empty, partial: false, failed: true});
        });
    }, 650);
    return () => {clearTimeout(timer); controller.abort();};
  }, [enabled, key, current, longitude, latitude, unnamed, keyword, diningType]);

  return {items: current?.items ?? empty, partial: current?.partial ?? false, failed: current?.failed ?? false,
    loading: Boolean(key && !current), available: key !== null, retry: () => setAttempt(value => value + 1)};
}
