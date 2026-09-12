'use client';

import {LAUNCH_CATEGORIES, type LaunchCategoryKey} from '@/lib/domain/place-types';

export default function LaunchCategorySelector({value, onChange}: {value: LaunchCategoryKey | null; onChange: (key: LaunchCategoryKey) => void}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-700">地点类型</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LAUNCH_CATEGORIES.map(item => (
          <button key={item.key} type="button" aria-pressed={value === item.key} onClick={() => onChange(item.key)}
            className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${value === item.key ? 'border-[#006633] bg-[#006633] text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>
            {item.label}
          </button>
        ))}
      </div>
      {value === 'tabletop' && <p className="mt-2 text-xs text-slate-500">请选择实际提供的活动：桌游、剧本杀可单选或同时选择，不自动视为同一种服务。</p>}
    </fieldset>
  );
}
