import type {ShopCategoryKey} from '../../types/shop';
import {getTaxonomyTagLabelZhCN} from '../domain/taxonomy';
import {LAUNCH_CATEGORIES, getLaunchTagOptions} from '../domain/place-types';

export const DISCOVERY_TABS: readonly {key: ShopCategoryKey; label: string}[] = [
  {key: 'all', label: '全部'},
  ...LAUNCH_CATEGORIES.map(({key, label}) => ({key, label})),
  {key: 'region', label: '区域'},
  {key: 'review', label: '推荐'}
];

export type L2Option = {
  value: string;
  labelKey: string;
  labelZhCN: string;
};

export type L2Group = {
  groupKey: string;
  groupLabelZhCN: string;
  options: readonly L2Option[];
};

function canonicalTagOption(value: string, labelKey: string): L2Option {
  const labelZhCN = getTaxonomyTagLabelZhCN(value);
  if (!labelZhCN) {
    throw new Error(`Unknown canonical filter tag: ${value}`);
  }
  return {value, labelKey, labelZhCN};
}

export const L2_TAGS: Record<Exclude<ShopCategoryKey, 'all'>, readonly L2Group[]> = {
  'hair-salon': [],
  bar: [],
  tabletop: [{groupKey: 'tabletopTypes', groupLabelZhCN: '活动类型', options: getLaunchTagOptions('tabletop').map(tag => canonicalTagOption(tag.slug, tag.slug))}],
  food: [
    {
      groupKey: 'storeTypes',
      groupLabelZhCN: '店铺类型',
      options: [
        canonicalTagOption('cha-chaan-teng', 'chaChaanTeng'),
        canonicalTagOption('hot-pot', 'hotPot'),
        canonicalTagOption('barbecue', 'bbqGrill'),
        canonicalTagOption('fast-food', 'siuMeiFastFood')
      ]
    },
    {
      groupKey: 'cuisines',
      groupLabelZhCN: '菜系',
      options: [
        canonicalTagOption('chinese-cuisine', 'noodlesCongee'),
        canonicalTagOption('portuguese-cuisine', 'portugueseCuisine'),
        canonicalTagOption('japanese-cuisine', 'japaneseKorean'),
        canonicalTagOption('korean-cuisine', 'japaneseKorean'),
        canonicalTagOption('southeast-asian-cuisine', 'southeastAsian'),
        canonicalTagOption('western-cuisine', 'westernBistro')
      ]
    },
    {
      groupKey: 'signatureProducts',
      groupLabelZhCN: '招牌品类',
      options: [
        canonicalTagOption('burger', 'burgerFriedChicken'),
        canonicalTagOption('fried-chicken', 'burgerFriedChicken'),
        canonicalTagOption('snack', 'friedSnacks')
      ]
    }
  ],
  drink: [
    {
      groupKey: 'beverages',
      groupLabelZhCN: '饮品',
      options: [
        canonicalTagOption('coffee', 'coffee'),
        canonicalTagOption('milk-tea', 'lemonTeaJuice'),
        canonicalTagOption('fruit-tea', 'lemonTeaJuice')
      ]
    },
    {
      groupKey: 'desserts',
      groupLabelZhCN: '甜点',
      options: [
        canonicalTagOption('bread', 'eggTartBakery'),
        canonicalTagOption('dessert', 'westernDessert'),
        canonicalTagOption('cake', 'westernDessert')
      ]
    }
  ],
  shopping: [
    {
      groupKey: 'shoppingTypes',
      groupLabelZhCN: '购物类型',
      options: [
        canonicalTagOption('clothing', 'clothing'),
        canonicalTagOption('electronics', 'electronics'),
        canonicalTagOption('supermarket', 'supermarket')
      ]
    }
  ],
  entertainment: [
    {
      groupKey: 'entertainmentTypes',
      groupLabelZhCN: '玩乐类型',
      options: [
        canonicalTagOption('karaoke', 'karaoke'),
        canonicalTagOption('cinema', 'cinema'),
        canonicalTagOption('board-games', 'boardGames'),
        canonicalTagOption('bar', 'bar'),
        canonicalTagOption('murder-mystery', 'murder-mystery')
      ]
    }
  ],
  service: [
    {
      groupKey: 'serviceTypes',
      groupLabelZhCN: '服务类型',
      options: [
        canonicalTagOption('printing', 'printing'),
        canonicalTagOption('hair-salon', 'hairSalon'),
        canonicalTagOption('repair-service', 'repairService')
      ]
    }
  ],
  vibe: [
    {
      groupKey: 'hotScenarios',
      groupLabelZhCN: '热门场景',
      options: [
        canonicalTagOption('group-gathering', 'groupGathering'),
        canonicalTagOption('photo-friendly', 'photoSpot'),
        canonicalTagOption('late-night', 'lateNight'),
        canonicalTagOption('delivery', 'deliveryAvailable')
      ]
    }
  ],
  deal: [
    {
      groupKey: 'dealTypes',
      groupLabelZhCN: '优惠类型',
      options: [
        canonicalTagOption('student-discount', 'studentIdDiscount')
      ]
    }
  ],
  review: [
    {
      groupKey: 'rankings',
      groupLabelZhCN: '榜单',
      options: [
        {value: '封神之作', labelKey: 'legendary', labelZhCN: '封神之作'},
        {value: '强烈推荐', labelKey: 'highlyRecommended', labelZhCN: '强烈推荐'},
        {value: '高性价比', labelKey: 'greatValue', labelZhCN: '高性价比'},
        {value: '隐藏好店', labelKey: 'hiddenGem', labelZhCN: '隐藏好店'},
        {value: '本周新上', labelKey: 'newThisWeek', labelZhCN: '本周新上'}
      ]
    }
  ],
  region: [
    {
      groupKey: 'regions',
      groupLabelZhCN: '区域',
      options: [
        {value: '澳门半岛', labelKey: 'macauPeninsula', labelZhCN: '澳门半岛'},
        {value: '氹仔岛', labelKey: 'taipa', labelZhCN: '氹仔岛'},
        {value: '路环岛', labelKey: 'coloane', labelZhCN: '路环岛'},
        {value: '香洲区', labelKey: 'xiangzhou', labelZhCN: '香洲区'},
        {value: '横琴区', labelKey: 'hengqin', labelZhCN: '横琴区'},
        {value: '其它', labelKey: 'others', labelZhCN: '其它'}
      ]
    }
  ]
};

export function getL2ValuesByCategory(category: Exclude<ShopCategoryKey, 'all'>): string[] {
  return L2_TAGS[category].flatMap((group) => group.options.map((option) => option.value));
}

export function getL2OptionByValue(value: string): L2Option | null {
  for (const groups of Object.values(L2_TAGS)) {
    for (const group of groups) {
      const matched = group.options.find((option) => option.value === value);
      if (matched) return matched;
    }
  }
  return null;
}
