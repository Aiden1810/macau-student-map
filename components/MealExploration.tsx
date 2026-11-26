'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {rankTasteExploration} from '@/lib/meal-history/exploration';
import {macauToday, type MealDraft, type PreferenceDraft} from '@/lib/meal-history/model';
import type {Shop} from '@/types/shop';

const BATCH_SIZE = 6;

export default function MealExploration({meals, preferences}: {meals: MealDraft[]; preferences: PreferenceDraft[]}) {
  const t = useTranslations('MealHistory');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [places, setPlaces] = useState<Shop[]>([]);
  const [onlyNew, setOnlyNew] = useState(false);
  const [offset, setOffset] = useState(0);

  const ranked = status === 'ready' ? rankTasteExploration(places, meals, preferences, macauToday()) : [];
  const filtered = onlyNew ? ranked.filter(item => item.recent === 'new') : ranked;
  const safeOffset = filtered.length > 0 ? offset % filtered.length : 0;
  const recommendations = filtered.length <= BATCH_SIZE
    ? filtered
    : Array.from({length: BATCH_SIZE}, (_, index) => filtered[(safeOffset + index) % filtered.length]);
  const canRotate = filtered.length > BATCH_SIZE;

  async function explore() {
    setStatus('loading');
    try {
      const response = await fetch('/api/places', {cache: 'no-store'});
      const body = await response.json();
      if (!response.ok || body?.ok !== true || body.data?.canonicalAvailable === false ||
          !Array.isArray(body.data?.items)) throw new Error('Published catalog unavailable');
      setPlaces(body.data.items);
      setOffset(0);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-line bg-white p-4 sm:p-5">
      <h2 className="text-lg font-semibold">{t('explore')}</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{t('exploreHint')}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={status === 'loading'} onClick={() => void explore()}
          className="min-h-11 rounded-lg bg-pine-800 px-4 text-sm font-medium text-white disabled:opacity-50">
          {t(status === 'loading' ? 'loading' : status === 'ready' ? 'refreshExplore' : 'findVariety')}
        </button>
        {status === 'ready' && canRotate && (
          <button type="button" onClick={() => setOffset(previous => previous + BATCH_SIZE)}
            className="min-h-11 rounded-lg border border-line bg-white px-4 text-sm font-medium text-pine-800 hover:bg-pine-50">
            {t('nextBatch')}
          </button>
        )}
        {status === 'ready' && meals.length > 0 && (
          <button type="button" aria-pressed={onlyNew}
            onClick={() => {setOnlyNew(previous => !previous); setOffset(0);}}
            className="min-h-11 rounded-lg border border-line px-3 text-sm font-medium text-pine-800 hover:bg-pine-50 aria-pressed:border-pine-700 aria-pressed:bg-pine-50">
            {t('onlyNewPlaces')}
          </button>
        )}
      </div>
      <div className="mt-2 text-sm text-muted" role="status">
        {status === 'error' && t('exploreFailed')}
        {status === 'ready' && (recommendations.length ? t('exploreCount', {count: filtered.length}) : t('exploreEmpty'))}
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
