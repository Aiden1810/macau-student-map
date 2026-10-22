'use client';

import {Bike, Check, Heart, Moon, Store} from 'lucide-react';
import {useTranslations} from 'next-intl';
import type {DrawerFiltersState, ShopFeature} from '@/types/shop';

interface QuickFiltersProps {
  compact?: boolean;
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

export default function QuickFilters({compact = false, count, loading, filters, onChange, showFavorites, onFavoritesChange, hasActiveFilters, extraLabels, onClear}: QuickFiltersProps) {
  const t = useTranslations('Filters');
  const chipClass = (active: boolean) =>
    `inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${active ? 'border-pine-200 bg-pine-50 font-semibold text-pine-800' : 'border-line bg-white text-muted hover:bg-canvas'}`;
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
        <button type="button" aria-pressed={filters.features.includes('小摊')} className={chipClass(filters.features.includes('小摊'))} onClick={() => toggleFeature('小摊')}>
          <Store aria-hidden="true" className="h-3.5 w-3.5" />{t('stalls')}
          {filters.features.includes('小摊') && <Check aria-hidden="true" className="h-3 w-3" />}
        </button>
      </div>
      {extraLabels.length > 0 && <p className="break-words text-xs text-slate-500">{extraLabels.join(' · ')}</p>}
      {(!compact || hasActiveFilters) && <div className="flex min-h-8 items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs text-slate-500">
        {!compact && <span role="status">{loading ? t('loadingPlaces') : t('foundPlaces', {count})}</span>}
        {hasActiveFilters && <button type="button" onClick={onClear} className="min-h-8 shrink-0 rounded px-1 text-emerald-700 hover:underline focus-visible:ring-2 focus-visible:ring-emerald-700">{t('clearFilters')}</button>}
      </div>}
    </section>
  );
}
