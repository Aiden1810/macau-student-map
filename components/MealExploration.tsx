'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {rankTasteExploration} from '@/lib/meal-history/exploration';
import {macauToday, type MealDraft, type PreferenceDraft} from '@/lib/meal-history/model';
import type {Shop} from '@/types/shop';

export default function MealExploration({meals, preferences}: {meals: MealDraft[]; preferences: PreferenceDraft[]}) {
  const t = useTranslations('MealHistory');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [places, setPlaces] = useState<Shop[]>([]);
  const recommendations = status === 'ready' ? rankTasteExploration(places, meals, preferences, macauToday()).slice(0, 6) : [];

  async function explore() {
    setStatus('loading');
    try {
      const response = await fetch('/api/places', {cache: 'no-store'});
      const body = await response.json();
      if (!response.ok || body?.ok !== true || body.data?.canonicalAvailable === false ||
          !Array.isArray(body.data?.items)) throw new Error('Published catalog unavailable');
      setPlaces(body.data.items);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-line bg-white p-4 sm:p-5">
      <h2 className="text-lg font-semibold">{t('explore')}</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{t('exploreHint')}</p>
      <button type="button" disabled={status === 'loading'} onClick={() => void explore()}
        className="mt-3 min-h-11 rounded-lg bg-pine-800 px-4 text-sm font-medium text-white disabled:opacity-50">
        {t(status === 'loading' ? 'loading' : status === 'ready' ? 'refreshExplore' : 'findVariety')}
      </button>
      <div className="mt-2 text-sm text-muted" role="status">
        {status === 'error' && t('exploreFailed')}
        {status === 'ready' && (recommendations.length ? t('exploreCount', {count: recommendations.length}) : t('exploreEmpty'))}
      </div>
      {recommendations.length > 0 && <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {recommendations.map(({place, recent}) => (
          <li key={place.id} className="rounded-lg border border-line px-3 py-2">
            <Link href={`/shop/${place.id}`} className="min-h-9 break-words text-sm font-semibold text-pine-900 underline">
              {place.name}
            </Link>
            {place.address && <p className="break-words text-xs text-muted">{place.address}</p>}
            {recent !== 'new' && <p className="mt-1 text-xs text-muted">
              {t(recent === 'restaurant' ? 'recentRestaurant' : 'recentCuisine')}
            </p>}
          </li>
        ))}
      </ul>}
    </section>
  );
}
