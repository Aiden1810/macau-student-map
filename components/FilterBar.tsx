'use client';

import {useMemo} from 'react';
import {DISCOVERY_TABS, L2_TAGS, type L2Group} from '@/lib/search/filter-options';
import {ShopCategoryKey} from '@/types/shop';

export {getL2OptionByValue, getL2ValuesByCategory, L2_TAGS} from '@/lib/search/filter-options';

export const L1_TABS = DISCOVERY_TABS;

interface FilterBarProps {
  activeL1: ShopCategoryKey;
  activeL2: string | null;
  onChange: (l1: ShopCategoryKey, l2: string | null) => void;
}

export default function FilterBar({activeL1, activeL2, onChange}: FilterBarProps) {

  const groupedL2Tags = useMemo(() => {
    if (activeL1 === 'all') {
      return [] as readonly L2Group[];
    }

    return L2_TAGS[activeL1] ?? [];
  }, [activeL1]);

  return (
    <section className="bg-transparent p-0">
      <div className="relative">
        <div className="hide-scrollbar relative z-40 flex items-center gap-2 overflow-x-auto pb-1 pr-6 md:flex-wrap md:overflow-visible md:pr-0">
          {L1_TABS.map((tab) => {
            const isReview = tab.key === 'review';
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={activeL1 === tab.key}
                onClick={() => onChange(tab.key, null)}
                className={`relative z-40 h-8 shrink-0 items-center justify-center rounded-[15px] border px-4 text-sm font-semibold leading-none transition md:min-h-10 md:h-auto ${isReview ? 'hidden md:inline-flex' : 'inline-flex'} ${
                  activeL1 === tab.key
                    ? 'border-[rgba(26,92,46,0.35)] bg-[rgba(22,80,38,0.12)] text-[#0d2918]'
                    : 'border-[rgba(0,0,0,0.08)] bg-[rgba(255,255,255,0.55)] text-[#0d2918] shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-[16px]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="pointer-events-none absolute right-0 top-0 z-50 h-full w-8 bg-gradient-to-l from-white/10 to-transparent md:hidden" />
      </div>

      {activeL1 !== 'all' && (
        <div className="mt-2 hidden space-y-2 md:block">
          {groupedL2Tags.map((group) => (
            <div key={group.groupKey} className="space-y-1">
              <p className="px-1 text-xs font-semibold text-slate-500">{group.groupLabelZhCN}</p>
              <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
                {group.options.map((option) => {
                  const isActive = activeL2 === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => onChange(activeL1, option.value)}
                      className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium transition ${
                        isActive
                          ? 'border-[#FFCC00] bg-[#FFF9E6] text-[#006633]'
                          : 'border-slate-200 bg-white text-slate-600 active:scale-[0.99]'
                      }`}
                    >
                      {option.labelZhCN}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
