'use client';

import {useMemo} from 'react';
import {useTranslations} from 'next-intl';
import {ShopCategoryKey} from '@/types/shop';

export const L1_TABS: Array<{key: ShopCategoryKey; labelKey: string}> = [
  {key: 'all', labelKey: 'all'},
  {key: 'food', labelKey: 'food'},
  {key: 'drink', labelKey: 'drinksDesserts'},
  {key: 'vibe', labelKey: 'scenario'},
  {key: 'region', labelKey: 'area'},
  {key: 'review', labelKey: 'topPicks'}
];

type L2Option = {
  value: string;
  labelKey: string;
};

type L2Group = {
  groupKey: string;
  options: readonly L2Option[];
};

export const L2_TAGS: Record<Exclude<ShopCategoryKey, 'all'>, readonly L2Group[]> = {
  food: [
    {
      groupKey: 'dailyMeals',
      options: [
        {value: '茶餐厅 / 冰室', labelKey: 'chaChaanTeng'},
        {value: '烧腊 / 快餐', labelKey: 'siuMeiFastFood'},
        {value: '粉面 / 粥店', labelKey: 'noodlesCongee'},
        {value: '汉堡 / 炸鸡', labelKey: 'burgerFriedChicken'}
      ]
    },
    {
      groupKey: 'groupDining',
      options: [
        {value: '火锅 / 焖锅', labelKey: 'hotPot'},
        {value: '烧烤 / 烤肉', labelKey: 'bbqGrill'},
        {value: '葡国菜', labelKey: 'portugueseCuisine'},
        {value: '粤菜 / 早茶', labelKey: 'cantoneseDimSum'},
        {value: '日韩料理', labelKey: 'japaneseKorean'},
        {value: '东南亚菜', labelKey: 'southeastAsian'},
        {value: '西餐 / 简餐', labelKey: 'westernBistro'}
      ]
    },
    {
      groupKey: 'streetSnacks',
      options: [
        {value: '炸物 / 小食', labelKey: 'friedSnacks'},
        {value: '牛杂 / 串串', labelKey: 'offalSkewers'},
        {value: '葡挞 / 烘焙', labelKey: 'eggTartBakery'}
      ]
    }
  ],
  drink: [
    {
      groupKey: 'refreshing',
      options: [
        {value: '柠茶 / 果汁', labelKey: 'lemonTeaJuice'},
        {value: '咖啡', labelKey: 'coffee'}
      ]
    },
    {
      groupKey: 'sweetTooth',
      options: [
        {value: '传统糖水', labelKey: 'traditionalDessertSoup'},
        {value: '西式甜品', labelKey: 'westernDessert'},
        {value: '冰品 / 雪糕', labelKey: 'iceCream'}
      ]
    },
    {
      groupKey: 'nightSocial',
      options: [{value: '清吧 / 微醺', labelKey: 'chillBar'}]
    }
  ],
  vibe: [
    {
      groupKey: 'hotScenarios',
      options: [
        {value: '🍜 一人食友好', labelKey: 'soloFriendly'},
        {value: '🍻 聚餐 / 团建', labelKey: 'groupGathering'},
        {value: '💻 适合赶Due', labelKey: 'studyWork'},
        {value: '📸 拍照出片', labelKey: 'photoSpot'},
        {value: '💕 约会 / 生日', labelKey: 'dateBirthday'},
        {value: '🌙 深夜夜宵', labelKey: 'lateNight'}
      ]
    }
  ],
  deal: [
    {
      groupKey: 'dealTypes',
      options: [
        {value: '学生证折扣', labelKey: 'studentIdDiscount'},
        {value: '买一送一', labelKey: 'buyOneGetOne'},
        {value: '限时特惠', labelKey: 'limitedOffer'},
        {value: '满减', labelKey: 'thresholdDiscount'},
        {value: '新店开业', labelKey: 'newlyOpened'}
      ]
    }
  ],
  review: [
    {
      groupKey: 'rankings',
      options: [
        {value: '封神之作', labelKey: 'legendary'},
        {value: '强烈推荐', labelKey: 'highlyRecommended'},
        {value: '高性价比', labelKey: 'greatValue'},
        {value: '隐藏好店', labelKey: 'hiddenGem'},
        {value: '本周新上', labelKey: 'newThisWeek'}
      ]
    }
  ],
  region: [
    {
      groupKey: 'regions',
      options: [
        {value: '澳门半岛', labelKey: 'macauPeninsula'},
        {value: '氹仔岛', labelKey: 'taipa'},
        {value: '路环岛', labelKey: 'coloane'},
        {value: '香洲区', labelKey: 'xiangzhou'},
        {value: '横琴区', labelKey: 'hengqin'},
        {value: '其它', labelKey: 'others'}
      ]
    }
  ]
};

export function getL2ValuesByCategory(category: Exclude<ShopCategoryKey, 'all'>): string[] {
  return L2_TAGS[category].flatMap((group) => group.options.map((option) => option.value));
}

export function getL2LabelKeyByValue(value: string): string | null {
  for (const groups of Object.values(L2_TAGS)) {
    for (const group of groups) {
      const matched = group.options.find((option) => option.value === value);
      if (matched) {
        return matched.labelKey;
      }
    }
  }

  return null;
}

interface FilterBarProps {
  activeL1: ShopCategoryKey;
  activeL2: string | null;
  onChange: (l1: ShopCategoryKey, l2: string | null) => void;
}

export default function FilterBar({activeL1, activeL2, onChange}: FilterBarProps) {
  const tFilters = useTranslations('Filters');

  const groupedL2Tags = useMemo(() => {
    if (activeL1 === 'all') {
      return [] as readonly L2Group[];
    }

    return L2_TAGS[activeL1] ?? [];
  }, [activeL1]);

  return (
    <section className="bg-transparent p-0">
      <div className="relative">
        <div className="hide-scrollbar relative z-40 flex items-center gap-2 overflow-x-auto pb-1 pr-6">
          {L1_TABS.map((tab) => {
            const isReview = tab.key === 'review';
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onChange(tab.key, null)}
                className={`relative z-40 h-8 shrink-0 items-center justify-center rounded-[15px] border px-4 text-sm font-semibold leading-none transition md:min-h-10 md:h-auto ${isReview ? 'hidden md:inline-flex' : 'inline-flex'} ${
                  activeL1 === tab.key
                    ? 'border-[rgba(26,92,46,0.35)] bg-[rgba(22,80,38,0.12)] text-[#0d2918]'
                    : 'border-[rgba(0,0,0,0.08)] bg-[rgba(255,255,255,0.55)] text-[#0d2918] shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-[16px]'
                }`}
              >
                {tFilters(tab.labelKey)}
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
              <p className="px-1 text-xs font-semibold text-slate-500">{tFilters(`l2Groups.${group.groupKey}`)}</p>
              <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
                {group.options.map((option) => {
                  const isActive = activeL2 === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onChange(activeL1, isActive ? null : option.value)}
                      className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium transition ${
                        isActive
                          ? 'border-[#FFCC00] bg-[#FFF9E6] text-[#006633]'
                          : 'border-slate-200 bg-white text-slate-600 active:scale-[0.99]'
                      }`}
                    >
                      {tFilters(`l2Tags.${option.labelKey}`)}
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
