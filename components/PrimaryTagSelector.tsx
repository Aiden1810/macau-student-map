'use client';

import {getTaxonomyTagLabelZhCN, OTHER_CUISINE_SLUGS} from '@/lib/domain/taxonomy';

type TagOption = {id: string; slug: string};

export default function PrimaryTagSelector({tags, selected, onToggle}: {
  tags: readonly TagOption[];
  selected: readonly string[];
  onToggle: (id: string) => void;
}) {
  const otherTags = OTHER_CUISINE_SLUGS.flatMap(slug => tags.filter(tag => tag.slug === slug));
  const selectedOther = otherTags.filter(tag => selected.includes(tag.id));
  const buttons = (options: readonly TagOption[]) => <div className="flex flex-wrap gap-2">{options.map(tag => {
    const active = selected.includes(tag.id);
    return <button key={tag.id} type="button" aria-pressed={active}
      disabled={!active && selected.length >= 8} onClick={() => onToggle(tag.id)}
      className={`min-h-10 rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:opacity-50 ${active ? 'border-emerald-800 bg-emerald-800 text-white' : 'border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50'}`}>
      {tag.slug === 'other-cuisine' ? '其他／暂未细分' : getTaxonomyTagLabelZhCN(tag.slug)}
    </button>;
  })}</div>;

  return <div className="space-y-3">
    {buttons(tags.filter(tag => !OTHER_CUISINE_SLUGS.includes(tag.slug)))}
    {otherTags.length > 0 && <details open={selectedOther.length > 0 || undefined} className="rounded-lg border border-emerald-200 bg-white">
      <summary className="min-h-11 cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
        其他菜系{selectedOther.length > 0 && <span className="ml-2 text-xs font-normal">已选：{selectedOther.map(tag => getTaxonomyTagLabelZhCN(tag.slug)).join('、')}</span>}
      </summary>
      <div className="space-y-2 border-t border-emerald-100 p-3">
        <p className="text-xs leading-5 text-slate-500">选择实际主营的菜系，可多选；没有合适选项时选择“其他／暂未细分”。</p>
        {buttons(otherTags)}
      </div>
    </details>}
  </div>;
}
