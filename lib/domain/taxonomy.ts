export type PlaceCategorySlug = 'food' | 'shopping' | 'entertainment' | 'service';

export type TagKind = 'category' | 'cuisine' | 'product' | 'scene' | 'facility' | 'deal';

export type PlaceCategoryDefinition = {
  slug: PlaceCategorySlug;
  labelZhMO: string;
  labelEn: string;
  sortOrder: number;
};

export type TaxonomyTag = {
  id: string;
  slug: string;
  kind: TagKind;
  labelZhMO: string;
  labelEn: string;
  aliases: readonly string[];
  legacyLabels?: readonly string[];
};

export const PLACE_CATEGORIES: readonly PlaceCategoryDefinition[] = [
  {slug: 'food', labelZhMO: '美食', labelEn: 'Food', sortOrder: 10},
  {slug: 'shopping', labelZhMO: '購物', labelEn: 'Shopping', sortOrder: 20},
  {slug: 'entertainment', labelZhMO: '娛樂', labelEn: 'Entertainment', sortOrder: 30},
  {slug: 'service', labelZhMO: '生活服務', labelEn: 'Services', sortOrder: 40}
] as const;

export const TAG_CATALOG: readonly TaxonomyTag[] = [
  {
    id: '00000000-0000-0000-0000-000000000101',
    slug: 'chinese-cuisine',
    kind: 'cuisine',
    labelZhMO: '中餐',
    labelEn: 'Chinese cuisine',
    aliases: ['中餐', '中菜', '粵菜', '粤菜', '飯', '饭'],
    legacyLabels: ['粉面', '粥店', '粉面 / 粥店']
  },
  {
    id: '00000000-0000-0000-0000-000000000102',
    slug: 'portuguese-cuisine',
    kind: 'cuisine',
    labelZhMO: '葡國菜',
    labelEn: 'Portuguese cuisine',
    aliases: ['葡國菜', '葡国菜', '葡餐', 'portuguese food']
  },
  {
    id: '00000000-0000-0000-0000-000000000103',
    slug: 'cha-chaan-teng',
    kind: 'category',
    labelZhMO: '茶餐廳',
    labelEn: 'Cha chaan teng',
    aliases: ['茶餐廳', '茶餐厅', '冰室', 'cha chaan teng'],
    legacyLabels: ['茶餐厅 / 冰室']
  },
  {
    id: '00000000-0000-0000-0000-000000000104',
    slug: 'hot-pot',
    kind: 'category',
    labelZhMO: '火鍋',
    labelEn: 'Hot pot',
    aliases: ['火鍋', '火锅', '打邊爐', '打边炉', 'hotpot', 'hot pot'],
    legacyLabels: ['火锅 / 焖锅']
  },
  {
    id: '00000000-0000-0000-0000-000000000105',
    slug: 'western-cuisine',
    kind: 'cuisine',
    labelZhMO: '西餐',
    labelEn: 'Western cuisine',
    aliases: ['西餐', 'western food', 'bistro'],
    legacyLabels: ['西餐 / 简餐']
  },
  {
    id: '00000000-0000-0000-0000-000000000106',
    slug: 'japanese-cuisine',
    kind: 'cuisine',
    labelZhMO: '日料',
    labelEn: 'Japanese cuisine',
    aliases: ['日料', '日本菜', '日本料理', '壽司', '寿司', 'japanese food'],
    legacyLabels: ['日韩料理']
  },
  {
    id: '00000000-0000-0000-0000-000000000107',
    slug: 'korean-cuisine',
    kind: 'cuisine',
    labelZhMO: '韓餐',
    labelEn: 'Korean cuisine',
    aliases: ['韓餐', '韩餐', '韓式', '韩式', 'korean food']
  },
  {
    id: '00000000-0000-0000-0000-000000000108',
    slug: 'barbecue',
    kind: 'category',
    labelZhMO: '烤肉',
    labelEn: 'Barbecue',
    aliases: ['烤肉', '燒烤', '烧烤', 'bbq', 'barbecue'],
    legacyLabels: ['烧烤 / 烤肉']
  },
  {
    id: '00000000-0000-0000-0000-000000000109',
    slug: 'snack',
    kind: 'product',
    labelZhMO: '小食',
    labelEn: 'Snacks',
    aliases: ['小食', '小吃', '街頭小食', '街头小吃', 'snack', 'snacks'],
    legacyLabels: ['牛杂', '炸物 / 小食', '牛杂 / 串串']
  },
  {
    id: '00000000-0000-0000-0000-000000000110',
    slug: 'fast-food',
    kind: 'category',
    labelZhMO: '快餐',
    labelEn: 'Fast food',
    aliases: ['快餐', '速食', 'fast food'],
    legacyLabels: ['烧腊 / 快餐']
  },
  {
    id: '00000000-0000-0000-0000-000000000111',
    slug: 'southeast-asian-cuisine',
    kind: 'cuisine',
    labelZhMO: '東南亞菜',
    labelEn: 'Southeast Asian cuisine',
    aliases: ['東南亞菜', '东南亚菜', '泰餐', '越南菜', 'southeast asian']
  },
  {
    id: '00000000-0000-0000-0000-000000000201',
    slug: 'coffee',
    kind: 'product',
    labelZhMO: '咖啡',
    labelEn: 'Coffee',
    aliases: ['咖啡', '咖啡店', '咖啡館', '咖啡馆', 'coffee', 'cafe']
  },
  {
    id: '00000000-0000-0000-0000-000000000202',
    slug: 'milk-tea',
    kind: 'product',
    labelZhMO: '奶茶',
    labelEn: 'Milk tea',
    aliases: ['奶茶', '珍珠奶茶', '波霸', 'milk tea', 'boba', 'bubble tea']
  },
  {
    id: '00000000-0000-0000-0000-000000000203',
    slug: 'fruit-tea',
    kind: 'product',
    labelZhMO: '果茶',
    labelEn: 'Fruit tea',
    aliases: ['果茶', '水果茶', '檸檬茶', '柠檬茶', 'fruit tea']
  },
  {
    id: '00000000-0000-0000-0000-000000000301',
    slug: 'bread',
    kind: 'product',
    labelZhMO: '麵包',
    labelEn: 'Bread and bakery',
    aliases: ['麵包', '面包', '烘焙', 'bread', 'bakery'],
    legacyLabels: ['葡挞 / 烘焙']
  },
  {
    id: '00000000-0000-0000-0000-000000000302',
    slug: 'dessert',
    kind: 'product',
    labelZhMO: '甜品',
    labelEn: 'Dessert',
    aliases: ['甜品', '甜點', '甜点', '糖水', 'dessert', 'sweets'],
    legacyLabels: ['传统糖水', '西式甜品']
  },
  {
    id: '00000000-0000-0000-0000-000000000303',
    slug: 'cake',
    kind: 'product',
    labelZhMO: '蛋糕',
    labelEn: 'Cake',
    aliases: ['蛋糕', 'cake', 'cakes', 'cheesecake']
  },
  {
    id: '00000000-0000-0000-0000-000000000501',
    slug: 'burger',
    kind: 'product',
    labelZhMO: '漢堡',
    labelEn: 'Burger',
    aliases: ['漢堡', '汉堡', 'burger', 'burgers', 'hamburger'],
    legacyLabels: ['汉堡 / 炸鸡']
  },
  {
    id: '00000000-0000-0000-0000-000000000502',
    slug: 'fried-chicken',
    kind: 'product',
    labelZhMO: '炸雞',
    labelEn: 'Fried chicken',
    aliases: ['炸雞', '炸鸡', 'fried chicken'],
    legacyLabels: ['汉堡 / 炸鸡']
  },
  {
    id: '00000000-0000-0000-0000-000000000601',
    slug: 'clothing',
    kind: 'product',
    labelZhMO: '服飾',
    labelEn: 'Clothing',
    aliases: ['服飾', '服饰', '衣服', '時裝', '时装', 'clothing', 'fashion']
  },
  {
    id: '00000000-0000-0000-0000-000000000602',
    slug: 'electronics',
    kind: 'product',
    labelZhMO: '電子產品',
    labelEn: 'Electronics',
    aliases: ['電子產品', '电子产品', '數碼', '数码', '手機', '手机', 'electronics']
  },
  {
    id: '00000000-0000-0000-0000-000000000603',
    slug: 'supermarket',
    kind: 'category',
    labelZhMO: '超級市場',
    labelEn: 'Supermarket',
    aliases: ['超級市場', '超级市场', '超市', '便利店', 'supermarket']
  },
  {
    id: '00000000-0000-0000-0000-000000000701',
    slug: 'karaoke',
    kind: 'category',
    labelZhMO: '卡拉 OK',
    labelEn: 'Karaoke',
    aliases: ['卡拉 ok', '卡拉ok', '唱 k', '唱k', 'ktv', 'karaoke']
  },
  {
    id: '00000000-0000-0000-0000-000000000702',
    slug: 'cinema',
    kind: 'category',
    labelZhMO: '電影院',
    labelEn: 'Cinema',
    aliases: ['電影院', '电影院', '戲院', '戏院', '電影', '电影', 'cinema', 'movie']
  },
  {
    id: '00000000-0000-0000-0000-000000000703',
    slug: 'board-games',
    kind: 'category',
    labelZhMO: '桌遊',
    labelEn: 'Board games',
    aliases: ['桌遊', '桌游', '桌遊店', '桌游店', 'board games']
  },
  {
    id: '00000000-0000-0000-0000-000000000901',
    slug: 'printing',
    kind: 'category',
    labelZhMO: '打印影印',
    labelEn: 'Printing',
    aliases: ['打印', '影印', '複印', '复印', '打印店', 'printing']
  },
  {
    id: '00000000-0000-0000-0000-000000000902',
    slug: 'hair-salon',
    kind: 'category',
    labelZhMO: '理髮美髮',
    labelEn: 'Hair salon',
    aliases: ['理髮', '理发', '美髮', '美发', '髮型屋', '发型屋', 'hair salon']
  },
  {
    id: '00000000-0000-0000-0000-000000000903',
    slug: 'repair-service',
    kind: 'category',
    labelZhMO: '維修服務',
    labelEn: 'Repair service',
    aliases: ['維修', '维修', '手機維修', '手机维修', '電腦維修', '电脑维修', 'repair']
  },
  {
    id: '00000000-0000-0000-0000-000000000401',
    slug: 'group-gathering',
    kind: 'scene',
    labelZhMO: '聚餐',
    labelEn: 'Group dining',
    aliases: ['聚餐', '團建', '团建', '聚會', '聚会'],
    legacyLabels: ['🍻 聚餐 / 团建']
  },
  {
    id: '00000000-0000-0000-0000-000000000403',
    slug: 'photo-friendly',
    kind: 'scene',
    labelZhMO: '適合拍照',
    labelEn: 'Photo friendly',
    aliases: ['適合拍照', '适合拍照', '拍照', '出片'],
    legacyLabels: ['📸 拍照出片']
  },
  {
    id: '00000000-0000-0000-0000-000000000405',
    slug: 'delivery',
    kind: 'facility',
    labelZhMO: '可外賣',
    labelEn: 'Delivery available',
    aliases: ['可外賣', '可外卖', '外賣', '外卖', 'delivery']
  },
  {
    id: '00000000-0000-0000-0000-000000000406',
    slug: 'late-night',
    kind: 'scene',
    labelZhMO: '深夜營業',
    labelEn: 'Open late',
    aliases: ['深夜營業', '深夜营业', '宵夜', '夜宵', 'open late'],
    legacyLabels: ['深夜夜宵', '🌙 深夜夜宵']
  },
  {
    id: '00000000-0000-0000-0000-000000000801',
    slug: 'student-discount',
    kind: 'deal',
    labelZhMO: '學生優惠',
    labelEn: 'Student discount',
    aliases: ['學生優惠', '学生优惠', '學生折扣', '学生折扣', '學生價', '学生价', 'student discount']
  }
] as const;

const TRADITIONAL_TO_SIMPLIFIED: Readonly<Record<string, string>> = {
  漢: '汉',
  雞: '鸡',
  國: '国',
  餐: '餐',
  廳: '厅',
  壽: '寿',
  韓: '韩',
  東: '东',
  亞: '亚',
  麵: '面',
  點: '点',
  飾: '饰',
  時: '时',
  團: '团',
  會: '会',
  適: '适',
  賣: '卖',
  業: '业',
  學: '学',
  優: '优',
  價: '价'
};

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split('')
    .map((character) => TRADITIONAL_TO_SIMPLIFIED[character] ?? character)
    .join('');
}

const tagById = new Map(TAG_CATALOG.map((tag) => [tag.id, tag]));
const tagBySlug = new Map(TAG_CATALOG.map((tag) => [tag.slug, tag]));

const tagsByAlias = TAG_CATALOG.reduce<Map<string, TaxonomyTag[]>>((index, tag) => {
  const terms = [tag.slug, tag.labelZhMO, tag.labelEn, ...tag.aliases, ...(tag.legacyLabels ?? [])];

  for (const term of terms) {
    const normalized = normalizeSearchText(term);
    const existing = index.get(normalized) ?? [];
    if (!existing.some((item) => item.id === tag.id)) {
      index.set(normalized, [...existing, tag]);
    }
  }

  return index;
}, new Map<string, TaxonomyTag[]>());

export function findTaxonomyTag(idOrSlug: string): TaxonomyTag | null {
  return tagById.get(idOrSlug) ?? tagBySlug.get(idOrSlug) ?? null;
}

export function resolveTagAlias(query: string): TaxonomyTag[] {
  return tagsByAlias.get(normalizeSearchText(query)) ?? [];
}

export function groupSelectedTags(tagIdsOrSlugs: readonly string[]): Partial<Record<TagKind, string[]>> {
  const grouped: Partial<Record<TagKind, string[]>> = {};
  const seen = new Set<string>();

  for (const idOrSlug of tagIdsOrSlugs) {
    const tag = findTaxonomyTag(idOrSlug);
    if (!tag || seen.has(tag.slug)) continue;

    seen.add(tag.slug);
    grouped[tag.kind] = [...(grouped[tag.kind] ?? []), tag.slug];
  }

  return grouped;
}
