'use client';

import {ChevronDown, Check} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {L2_TAGS, type L2Option} from '@/lib/search/filter-options';
import {findTaxonomyTag} from '@/lib/domain/taxonomy';
import {RECOMMENDATION_LIMITS} from '@/lib/search/recommendation-filters';
import {TRUST_THRESHOLDS} from '@/lib/ranking/confidence';
import type {ShopCategoryKey} from '@/types/shop';

interface SecondaryFiltersProps {
  category: ShopCategoryKey;
  selected: readonly string[];
  onSelect: (value: string | null) => void;
}

export default function SecondaryFilters({category, selected, onSelect}: SecondaryFiltersProps) {
  const t = useTranslations('Filters');
  const locale = useLocale();
  if (category === 'all') return null;
  const groups = L2_TAGS[category] ?? [];
  if (groups.length === 0) return null;

  const labelFor = (option: L2Option) => {
    if (locale === 'zh-CN') return option.labelZhCN;
    const tag = findTaxonomyTag(option.value);
    if (tag) return locale === 'en' ? tag.labelEn : tag.labelZhMO;
    return t.has(`l2Tags.${option.labelKey}`) ? t(`l2Tags.${option.labelKey}`) : option.labelZhCN;
  };
  const choiceClass = (active: boolean) =>
    `inline-flex min-h-10 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs leading-snug transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-700 focus-visible:ring-offset-2 ${active ? 'bg-pine-50 font-semibold text-pine-800 ring-1 ring-inset ring-pine-700/20' : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'}`;

  if (category === 'food') {
    const activeOption = groups.flatMap(group => group.options).find(option => selected.includes(option.value));
    const groupLabels: Record<string, string> = {
      storeTypes: t('foodTypes'), cuisines: t('foodCuisines'), signatureProducts: t('foodSnacks'),
      beverages: t('foodDrinks'), desserts: t('foodDesserts')
    };
    return (
      <details
        className="group rounded-xl border border-line bg-white"
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.currentTarget.open = false;
            event.currentTarget.querySelector('summary')?.focus();
          }
        }}
      >
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-700 [&::-webkit-details-marker]:hidden">
          <span className={activeOption ? 'font-semibold text-pine-800' : 'font-medium text-slate-700'}>
            {activeOption ? labelFor(activeOption) : t('allFood')}
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-500">
            {t('browseFood')}<ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="max-h-56 space-y-3 overflow-y-auto border-t border-slate-100 p-3">
          <button type="button" aria-pressed={selected.length === 0} className={choiceClass(selected.length === 0)}
            onClick={event => {
              onSelect(null);
              const details = event.currentTarget.closest('details');
              if (details) {details.open = false; details.querySelector('summary')?.focus();}
            }}>{t('allFood')}</button>
          {groups.map(group => (
            <div key={group.groupKey} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2">
              <p className="pt-2 text-xs leading-5 text-slate-500">{groupLabels[group.groupKey] ?? group.groupLabelZhCN}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.options.map(option => (
                  <button key={option.value} type="button" aria-pressed={selected.includes(option.value)}
                    className={choiceClass(selected.includes(option.value))}
                    onClick={event => {
                      onSelect(option.value);
                      const details = event.currentTarget.closest('details');
                      if (details) {details.open = false; details.querySelector('summary')?.focus();}
                    }}>
                    {labelFor(option)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl bg-slate-50/80 p-2">
        <button type="button" aria-pressed={selected.length === 0} className={choiceClass(selected.length === 0)} onClick={() => onSelect(null)}>
          {category === 'region' ? t('allRegions') : t('all')}
        </button>
        {groups.flatMap(group => group.options).map(option => (
          <button key={option.value} type="button" aria-pressed={selected.includes(option.value)}
            className={choiceClass(selected.includes(option.value))} onClick={() => onSelect(option.value)}>
            {selected.includes(option.value) && <Check aria-hidden="true" className="h-3 w-3" />}
            {labelFor(option)}
          </button>
        ))}
      </div>
      {category === 'review' && (
        <details className="group rounded-xl border border-line bg-white text-xs text-slate-600">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2 font-medium text-pine-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-700 [&::-webkit-details-marker]:hidden">
            {t('recommendationRules')}
            <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="max-h-52 space-y-2 overflow-y-auto border-t border-slate-100 px-3 py-3 leading-relaxed">
            <p>{t('rulesAll')}</p>
            <p>{t('rulesLegendary', {reviews: TRUST_THRESHOLDS.minimumReviews, score: TRUST_THRESHOLDS.excellent})}</p>
            <p>{t('rulesRecommended', {reviews: TRUST_THRESHOLDS.minimumReviews, score: TRUST_THRESHOLDS.recommended, upper: TRUST_THRESHOLDS.excellent})}</p>
            <p>{t('rulesBudget', {price: RECOMMENDATION_LIMITS.maxPrice})}</p>
            <p>{t('rulesRecent', {days: RECOMMENDATION_LIMITS.recentDays})}</p>
          </div>
        </details>
      )}
      </div>
    );
  }
