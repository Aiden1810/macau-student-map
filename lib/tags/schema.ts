import {
  TAG_CATALOG,
  findTaxonomyTag,
  resolveTagAlias,
  type TaxonomyTag
} from '../domain/taxonomy';

export type CanonicalLevel1 = '美食' | '饮品' | '甜点' | '场景' | '购物' | '娱乐' | '生活服务';

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

const DISPLAY_GROUP_SLUGS: ReadonlyArray<{
  level1: CanonicalLevel1;
  slugs: readonly string[];
}> = [
  {
    level1: '美食',
    slugs: [
      'chinese-cuisine',
      'portuguese-cuisine',
      'cha-chaan-teng',
      'hot-pot',
      'western-cuisine',
      'japanese-cuisine',
      'korean-cuisine',
      'barbecue',
      'snack',
      'fast-food',
      'southeast-asian-cuisine',
      'burger',
      'fried-chicken'
    ]
  },
  {level1: '饮品', slugs: ['coffee', 'milk-tea', 'fruit-tea']},
  {level1: '甜点', slugs: ['bread', 'dessert', 'cake']},
  {level1: '场景', slugs: ['group-gathering', 'photo-friendly', 'delivery', 'late-night', 'student-discount']},
  {level1: '购物', slugs: ['clothing', 'electronics', 'supermarket']},
  {level1: '娱乐', slugs: ['karaoke', 'cinema', 'board-games']},
  {level1: '生活服务', slugs: ['printing', 'hair-salon', 'repair-service']}
] as const;

function toOption(tag: TaxonomyTag, level1: CanonicalLevel1): CanonicalTagOption {
  return {
    tag_id: tag.id,
    tag_name: tag.labelZhMO,
    level1,
    level2: tag.labelZhMO
  };
}

export const CANONICAL_TAGS: CanonicalTagGroup[] = DISPLAY_GROUP_SLUGS.map((group) => ({
  level1: group.level1,
  options: group.slugs
    .map((slug) => findTaxonomyTag(slug))
    .filter((tag): tag is TaxonomyTag => tag !== null)
    .map((tag) => toOption(tag, group.level1))
}));

const levelByTagId = new Map(
  CANONICAL_TAGS.flatMap((group) => group.options.map((option) => [option.tag_id, group.level1] as const))
);

export function getCanonicalTagsForAdminAndSubmit(): CanonicalTagGroup[] {
  return CANONICAL_TAGS;
}

export function findTagById(tagId: string): CanonicalTagOption | null {
  const tag = findTaxonomyTag(tagId);
  const level1 = tag ? levelByTagId.get(tag.id) : null;
  return tag && level1 ? toOption(tag, level1) : null;
}

export function findTagByName(tagName: string): CanonicalTagOption | null {
  const tag = resolveTagAlias(tagName)[0] ?? findTaxonomyTag(tagName);
  return tag ? findTagById(tag.id) : null;
}

export function migrateLegacyTagsForSubmission(inputTags: string[]): {tagIds: string[]; tagNames: string[]} {
  const matchedTags = inputTags
    .flatMap((raw) => resolveTagAlias(raw))
    .filter((tag, index, all) => all.findIndex((candidate) => candidate.id === tag.id) === index)
    .filter((tag) => TAG_CATALOG.some((candidate) => candidate.id === tag.id));

  return {
    tagIds: matchedTags.map((tag) => tag.id),
    tagNames: matchedTags.map((tag) => tag.labelZhMO)
  };
}
