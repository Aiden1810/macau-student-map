'use client';

import {useMemo} from 'react';

export const FILTER_CONFIG = {
  美食: ['咖啡', '炸鸡', '茶餐厅', '甜品', '正餐', '夜宵', '日料', '奶茶', '韩料', '冰淇淋'],
  氛围: ['放松', '自习', '适合拍照', '安静'],
  评价: ['封神之作', '值得一试', '中规中矩', '建议避雷', '暂无评分']
} as const;

export type MainCategory = keyof typeof FILTER_CONFIG;
export type SubTag = (typeof FILTER_CONFIG)[MainCategory][number];

interface FilterBarProps {
  selectedCategory: MainCategory | null;
  selectedSubTag: SubTag | null;
  onChange: (category: MainCategory | null, subTag: SubTag | null) => void;
}

const MAIN_CATEGORY_OPTIONS: Array<MainCategory> = ['美食', '氛围', '评价'];

export default function FilterBar({selectedCategory, selectedSubTag, onChange}: FilterBarProps) {
  const subTagOptions = useMemo(() => {
    if (!selectedCategory) {
      return [] as string[];
    }

    return [...FILTER_CONFIG[selectedCategory]];
  }, [selectedCategory]);

  const handleAllClick = () => {
    onChange(null, null);
  };

  const handleCategoryClick = (category: MainCategory) => {
    if (selectedCategory === category) {
      onChange(null, null);
      return;
    }

    onChange(category, null);
  };

  const handleSubTagClick = (tag: SubTag) => {
    if (!selectedCategory) {
      return;
    }

    if (selectedSubTag === tag) {
      onChange(selectedCategory, null);
      return;
    }

    onChange(selectedCategory, tag);
  };

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur md:px-4 md:py-3">
      <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={handleAllClick}
          className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition ${
            selectedCategory === null
              ? 'border-[#006633] bg-[#006633] text-white'
              : 'border-slate-200 bg-white text-slate-700 active:scale-[0.99]'
          }`}
        >
          全部
        </button>

        {MAIN_CATEGORY_OPTIONS.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => handleCategoryClick(category)}
            className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition ${
              selectedCategory === category
                ? 'border-[#006633] bg-[#006633] text-white'
                : 'border-slate-200 bg-slate-50 text-slate-700 active:scale-[0.99]'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {selectedCategory && (
        <div className="hide-scrollbar mt-2 flex items-center gap-2 overflow-x-auto pb-1">
          {subTagOptions.map((tag) => {
            const typedTag = tag as SubTag;
            const isActive = selectedSubTag === typedTag;

            return (
              <button
                key={typedTag}
                type="button"
                onClick={() => handleSubTagClick(typedTag)}
                className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium transition ${
                  isActive
                    ? 'border-[#FFCC00] bg-[#FFF9E6] text-[#006633]'
                    : 'border-slate-200 bg-white text-slate-600 active:scale-[0.99]'
                }`}
              >
                {typedTag}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
