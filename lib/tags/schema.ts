export type CanonicalLevel1 = '美食' | '饮品' | '甜点' | '场景';

export type CanonicalTagOption = {
  tag_id: string;
  tag_name: string;
  level1: CanonicalLevel1;
  level2: string;
};

export type CanonicalTagGroup = {
  level1: CanonicalLevel1;
  options: CanonicalTagOption[];
};

// 固定 UUID，保证前后端/SQL 初始化一致，可安全用于提交与筛选。
export const CANONICAL_TAGS: CanonicalTagGroup[] = [
  {
    level1: '美食',
    options: [
      {tag_id: '00000000-0000-0000-0000-000000000101', tag_name: '中餐', level1: '美食', level2: '中餐'},
      {tag_id: '00000000-0000-0000-0000-000000000102', tag_name: '葡国菜', level1: '美食', level2: '葡国菜'},
      {tag_id: '00000000-0000-0000-0000-000000000103', tag_name: '茶餐厅', level1: '美食', level2: '茶餐厅'},
      {tag_id: '00000000-0000-0000-0000-000000000104', tag_name: '火锅', level1: '美食', level2: '火锅'},
      {tag_id: '00000000-0000-0000-0000-000000000105', tag_name: '西餐', level1: '美食', level2: '西餐'},
      {tag_id: '00000000-0000-0000-0000-000000000106', tag_name: '日料', level1: '美食', level2: '日料'},
      {tag_id: '00000000-0000-0000-0000-000000000107', tag_name: '韩餐', level1: '美食', level2: '韩餐'},
      {tag_id: '00000000-0000-0000-0000-000000000108', tag_name: '烤肉', level1: '美食', level2: '烤肉'},
      {tag_id: '00000000-0000-0000-0000-000000000109', tag_name: '小吃', level1: '美食', level2: '小吃'},
      {tag_id: '00000000-0000-0000-0000-000000000110', tag_name: '快餐', level1: '美食', level2: '快餐'},
      {tag_id: '00000000-0000-0000-0000-000000000111', tag_name: '东南亚菜', level1: '美食', level2: '东南亚菜'},
      {tag_id: '00000000-0000-0000-0000-000000000112', tag_name: '其它美食', level1: '美食', level2: '其它美食'}
    ]
  },
  {
    level1: '饮品',
    options: [
      {tag_id: '00000000-0000-0000-0000-000000000201', tag_name: '咖啡', level1: '饮品', level2: '咖啡'},
      {tag_id: '00000000-0000-0000-0000-000000000202', tag_name: '奶茶', level1: '饮品', level2: '奶茶'},
      {tag_id: '00000000-0000-0000-0000-000000000203', tag_name: '果茶', level1: '饮品', level2: '果茶'}
    ]
  },
  {
    level1: '甜点',
    options: [
      {tag_id: '00000000-0000-0000-0000-000000000301', tag_name: '面包', level1: '甜点', level2: '面包'},
      {tag_id: '00000000-0000-0000-0000-000000000302', tag_name: '甜品', level1: '甜点', level2: '甜品'},
      {tag_id: '00000000-0000-0000-0000-000000000303', tag_name: '蛋糕', level1: '甜点', level2: '蛋糕'}
    ]
  },
  {
    level1: '场景',
    options: [
      {tag_id: '00000000-0000-0000-0000-000000000401', tag_name: '聚餐', level1: '场景', level2: '聚餐'},
      {tag_id: '00000000-0000-0000-0000-000000000402', tag_name: '下午茶', level1: '场景', level2: '下午茶'},
      {tag_id: '00000000-0000-0000-0000-000000000403', tag_name: '拍照', level1: '场景', level2: '拍照'},
      {tag_id: '00000000-0000-0000-0000-000000000404', tag_name: '约会', level1: '场景', level2: '约会'},
      {tag_id: '00000000-0000-0000-0000-000000000405', tag_name: '可外卖', level1: '场景', level2: '可外卖'},
      {tag_id: '00000000-0000-0000-0000-000000000406', tag_name: '营业晚', level1: '场景', level2: '营业晚'}
    ]
  }
];

const LEGACY_MAP: Record<string, string> = {
  冰室: '茶餐厅',
  '茶餐厅 / 冰室': '茶餐厅',
  日韩料理: '日料',
  牛杂: '小吃',
  粉面: '中餐',
  粥店: '中餐',
  葡挞: '甜品',
  传统糖水: '甜品',
  西式甜品: '甜品',
  '西餐 / 简餐': '西餐',
  '烧烤 / 烤肉': '烤肉',
  深夜夜宵: '营业晚',
  '📸 拍照出片': '拍照',
  '💕 约会 / 生日': '约会',
  '🍻 聚餐 / 团建': '聚餐'
};

export function getCanonicalTagsForAdminAndSubmit(): CanonicalTagGroup[] {
  return CANONICAL_TAGS;
}

export function findTagById(tagId: string): CanonicalTagOption | null {
  for (const group of CANONICAL_TAGS) {
    const hit = group.options.find((item) => item.tag_id === tagId);
    if (hit) return hit;
  }
  return null;
}

export function findTagByName(tagName: string): CanonicalTagOption | null {
  const normalized = tagName.trim();
  for (const group of CANONICAL_TAGS) {
    const hit = group.options.find((item) => item.tag_name === normalized || item.level2 === normalized);
    if (hit) return hit;
  }
  return null;
}

export function migrateLegacyTagsForSubmission(inputTags: string[]): {tagIds: string[]; tagNames: string[]} {
  const mappedNames = Array.from(
    new Set(
      inputTags
        .map((raw) => raw.trim())
        .filter(Boolean)
        .map((raw) => LEGACY_MAP[raw] ?? raw)
    )
  );

  const tagOptions = mappedNames
    .map((name) => findTagByName(name))
    .filter((item): item is CanonicalTagOption => item !== null);

  return {
    tagIds: Array.from(new Set(tagOptions.map((item) => item.tag_id))),
    tagNames: Array.from(new Set(tagOptions.map((item) => item.tag_name)))
  };
}
