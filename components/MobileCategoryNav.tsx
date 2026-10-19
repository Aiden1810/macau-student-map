'use client';

import {Dices, MapPin, Scissors, Star, Utensils, Wine} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {DISCOVERY_TABS} from '@/lib/search/filter-options';
import type {ShopCategoryKey} from '@/types/shop';

const icons = {food: Utensils, 'hair-salon': Scissors, bar: Wine, tabletop: Dices, region: MapPin, review: Star};

export default function MobileCategoryNav({active, onChange}: {active: ShopCategoryKey; onChange: (key: ShopCategoryKey) => void}) {
  const locale = useLocale();
  const t = useTranslations('Filters');
  const translated: Record<string, string> = {all: t('all'), food: t('food'), region: t('area'), review: t('topPicks')};
  const english: Record<string, string> = {'hair-salon': 'Hair', bar: 'Bars', tabletop: 'Games'};
  return (
    <nav aria-label={t('browseFood')} className="hide-scrollbar flex gap-2 overflow-x-auto pb-2 pt-3">
      {DISCOVERY_TABS.map(({key, label}) => {
        const Icon = icons[key as keyof typeof icons];
        return <button key={key} type="button" aria-pressed={active === key} onClick={() => onChange(key)}
          className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium shadow-[0_2px_8px_#193d320a] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-700 ${active === key ? 'bg-pine-700 text-white' : 'border border-line/70 bg-white text-ink'}`}>
          {Icon && <Icon size={16} aria-hidden="true" />}{locale === 'zh-CN' ? label : translated[key] ?? (locale === 'en' ? english[key] ?? label : label)}
        </button>;
      })}
    </nav>
  );
}
