'use client';

import {Bike, Check, Heart, Moon} from 'lucide-react';
import {useTranslations} from 'next-intl';
import type {DrawerFiltersState, ShopFeature} from '@/types/shop';

interface QuickFiltersProps {
  count: number;
  loading: boolean;
  filters: DrawerFiltersState;
  onChange: (filters: DrawerFiltersState) => void;
  showFavorites?: boolean;
  onFavoritesChange?: (value: boolean) => void;
  hasActiveFilters: boolean;
  extraLabels: string[];
  onClear: () => void;
}

export default function QuickFilters({count, loading, filters, onChange, showFavorites, onFavoritesChange, hasActiveFilters, extraLabels, onClear}: QuickFiltersProps) {
  const t = useTranslations('Filters');
  const chipClass = (active: boolean) =>
    `inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${active ? 'bg-emerald-100 font-semibold text-emerald-900' : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'}`;
  const toggleFeature = (feature: ShopFeature) => onChange({
    ...filters,
    features: filters.features.includes(feature) ? filters.features.filter(value => value !== feature) : [...filters.features, feature]
  });

  return (
    <section aria-label={t('quickFilters')} className="space-y-2 py-1">
      <div className="hide-scrollbar flex gap-2 overflow-x-auto py-1">
        {showFavorites !== undefined && onFavoritesChange && (
          <button type="button" aria-pressed={showFavorites} className={chipClass(showFavorites)} onClick={() => onFavoritesChange(!showFavorites)}>
            <Heart aria-hidden="true" className={`h-3.5 w-3.5 ${showFavorites ? 'fill-current' : ''}`} />{t('onlyFavorites')}
          </button>
        )}
        <button type="button" aria-pressed={filters.features.includes('外卖可达')} className={chipClass(filters.features.includes('外卖可达'))} onClick={() => toggleFeature('外卖可达')}>
          <Bike aria-hidden="true" className="h-3.5 w-3.5" />{t('deliveryAvailable')}
          {filters.features.includes('外卖可达') && <Check aria-hidden="true" className="h-3 w-3" />}
        </button>
        <button type="button" aria-pressed={filters.features.includes('深夜营业')} className={chipClass(filters.features.includes('深夜营业'))} onClick={() => toggleFeature('深夜营业')}>
          <Moon aria-hidden="true" className="h-3.5 w-3.5" />{t('openLate')}
          {filters.features.includes('深夜营业') && <Check aria-hidden="true" className="h-3 w-3" />}
        </button>
      </div>
      {extraLabels.length > 0 && <p className="break-words text-xs text-slate-500">{extraLabels.join(' · ')}</p>}
      <div className="flex min-h-8 items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs text-slate-500">
        <span role="status">{loading ? t('loadingPlaces') : t('foundPlaces', {count})}</span>
        {hasActiveFilters && <button type="button" onClick={onClear} className="min-h-8 shrink-0 rounded px-1 text-emerald-700 hover:underline focus-visible:ring-2 focus-visible:ring-emerald-700">{t('clearFilters')}</button>}
      </div>
    </section>
  );
}
