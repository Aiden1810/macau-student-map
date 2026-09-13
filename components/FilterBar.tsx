'use client';

import {DISCOVERY_TABS} from '@/lib/search/filter-options';
import SecondaryFilters from '@/components/SecondaryFilters';
import type {ShopCategoryKey} from '@/types/shop';

export {getL2OptionByValue, getL2ValuesByCategory, L2_TAGS} from '@/lib/search/filter-options';
export const L1_TABS = DISCOVERY_TABS;

interface FilterBarProps {
  activeL1: ShopCategoryKey;
  activeL2: readonly string[];
  onCategoryChange: (category: ShopCategoryKey) => void;
  onSecondaryChange: (value: string | null) => void;
}

export default function FilterBar({activeL1, activeL2, onCategoryChange, onSecondaryChange}: FilterBarProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 pb-2">
        {L1_TABS.map(tab => (
          <button key={tab.key} type="button" aria-pressed={activeL1 === tab.key}
            onClick={() => onCategoryChange(tab.key)}
            className={`min-h-10 rounded-xl px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${activeL1 === tab.key ? 'bg-emerald-100/80 font-semibold text-emerald-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
            {tab.label}
          </button>
        ))}
      </div>
      <SecondaryFilters key={activeL1} category={activeL1} selected={activeL2} onSelect={onSecondaryChange} />
    </section>
  );
}
