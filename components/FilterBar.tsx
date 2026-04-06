'use client';

import {useMemo} from 'react';
import {ShopCategoryKey} from '@/types/shop';

export const L1_TABS: Array<{key: ShopCategoryKey; label: string}> = [
  {key: 'all', label: '全部'},
  {key: 'food', label: '美食'},
  {key: 'drink', label: '饮品'},
  {key: 'vibe', label: '氛围'},
  {key: 'deal', label: '优惠'},
  {key: 'review', label: '口碑'}
];

export const L2_TAGS = {
  food: {
    澳门本地: ['猪扒包', '葡挞', '水蟹粥', '杏仁饼', '马介休'],
    快餐小吃: ['炸鸡', '汉堡', '肠粉', '煎饼', '三文治'],
    正餐: ['粤菜', '葡国菜', '日料', '火锅', '东南亚菜', '西餐']
  },
  drink: {
    热门品类: ['奶茶', '咖啡', '果汁', '手打柠檬茶', '特调'],
    甜点: ['蛋糕', '雪糕', '麻薯', '甜品汤', '班戟']
  },
  vibe: {
    适合场景: ['约会', '朋友聚餐', '独自一人', '生日庆祝', '拍照出片'],
    环境特色: ['有露台', '复古风', 'ins风', '安静', '景观好', '宠物友好']
  },
  deal: {
    优惠类型: ['学生证折扣', '买一送一', '限时特惠', '满减', '新店开业']
  },
  review: {
    榜单: ['封神之作', '强烈推荐', '高性价比', '隐藏好店', '本周新上']
  }
} as const;

export type L2GroupMap = typeof L2_TAGS;

interface FilterBarProps {
  activeL1: ShopCategoryKey;
  activeL2: string | null;
  onChange: (l1: ShopCategoryKey, l2: string | null) => void;
}

const MOBILE_GLASS_STYLE = {
  background: 'rgba(255, 255, 255, 0.18)',
  backdropFilter: 'blur(28px) saturate(2.2)',
  WebkitBackdropFilter: 'blur(28px) saturate(2.2)',
  border: '0.5px solid rgba(255, 255, 255, 0.65)',
  boxShadow: '0 3px 18px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.55)'
} as const;

export default function FilterBar({activeL1, activeL2, onChange}: FilterBarProps) {
  const groupedL2Tags = useMemo(() => {
    if (activeL1 === 'all') {
      return {} as Record<string, readonly string[]>;
    }

    return (L2_TAGS as Partial<Record<Exclude<ShopCategoryKey, 'all'>, Record<string, readonly string[]>>>)[activeL1] ?? {};
  }, [activeL1]);

  return (
    <section className="rounded-2xl px-2 py-2 md:rounded-2xl md:border md:border-slate-200/80 md:bg-white/95 md:px-4 md:py-3 md:shadow-sm md:backdrop-blur" style={MOBILE_GLASS_STYLE}>
      <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
        {L1_TABS.map((tab) => {
          const isReview = tab.key === 'review';
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key, null)}
              className={`min-h-10 shrink-0 rounded-2xl border px-4 text-sm font-semibold transition ${isReview ? 'hidden md:inline-flex' : 'inline-flex'} ${
                activeL1 === tab.key
                  ? 'border-[rgba(60,160,80,0.25)] bg-[rgba(22,80,38,0.82)] text-[rgba(210,255,225,0.95)]'
                  : 'border-white/45 bg-white/5 text-[#0d2918] md:border-slate-200 md:bg-slate-50 md:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeL1 !== 'all' && (
        <div className="mt-2 hidden space-y-2 md:block">
          {Object.entries(groupedL2Tags).map(([group, tags]) => (
            <div key={group} className="space-y-1">
              <p className="px-1 text-xs font-semibold text-slate-500">{group}</p>
              <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
                {tags.map((tag) => {
                  const isActive = activeL2 === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onChange(activeL1, isActive ? null : tag)}
                      className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium transition ${
                        isActive
                          ? 'border-[#FFCC00] bg-[#FFF9E6] text-[#006633]'
                          : 'border-slate-200 bg-white text-slate-600 active:scale-[0.99]'
                      }`}
                    >
                      {tag}
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
