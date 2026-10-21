import {z} from 'zod';
import {findTaxonomyTag, normalizeSearchText, resolveSearchTagAlias} from '../domain/taxonomy';
import {isPrimaryTag, PRIMARY_TAG_SLUGS} from '../domain/place-types';
import type {AdminAccount} from './accounts';

export const postgresUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const optionalText = (max: number) => z.string().trim().max(max).nullable().transform(value => value || null);

export const adminPlaceSchema = z.object({
  name: z.string().trim().min(1, '请填写地点名称').max(120),
  nameEn: optionalText(120).default(null),
  address: optionalText(500).default(null),
  categorySlug: z.enum(['food', 'shopping', 'entertainment', 'service']),
  region: z.enum(['macau-peninsula', 'taipa', 'coloane', 'hengqin', 'zhuhai', 'other']).nullable().default(null),
  longitude: z.number().finite().min(-180).max(180).nullable(),
  latitude: z.number().finite().min(-90).max(90).nullable(),
  pricePerPerson: z.number().finite().min(0).max(100_000).nullable().default(null),
  tagIds: z.array(postgresUuid).min(1, '请选择具体类型').max(8),
  searchKeywords: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
  status: z.enum(['draft', 'published', 'archived']).default('published')
}).strict();

export type AdminPlaceInput = z.infer<typeof adminPlaceSchema>;
export type EditorMedia = {id: string; url: string | null; sortOrder: number; previewError?: string};
export type AdminPlaceRecord = AdminPlaceInput & {id: string; updatedAt: string; media: EditorMedia[]; pendingSubmissionIds?: string[]; createdBy?: AdminAccount | null};
export type SubmissionEditorRecord = AdminPlaceInput & {id: string; version: number; notes: string | null; media: EditorMedia[]};

export function matchesAdminPlaceSearch(place: Pick<AdminPlaceInput, 'name' | 'nameEn' | 'address' | 'tagIds' | 'searchKeywords'>, query: string): boolean {
  const normalized = normalizeSearchText(query);
  const tags = place.tagIds.map(findTaxonomyTag).filter(tag => tag !== null);
  if (resolveSearchTagAlias(query).some(match => tags.some(tag => tag.id === match.id))) return true;
  return [place.name, place.nameEn, place.address, ...place.searchKeywords,
    ...tags.flatMap(tag => [tag.labelZhMO, tag.labelEn, ...tag.aliases])]
    .some(value => value != null && normalizeSearchText(value).includes(normalized));
}

export const PLACE_STATUS_LABELS = {draft: '草稿', published: '已上线', archived: '已下架'} as const;
export const LEGACY_STATUS_LABELS = {pending: '待审核', verified: '已上线', rejected: '已驳回'} as const;

export function prepareAdminPlaceInput(input: unknown): AdminPlaceInput {
  const value = adminPlaceSchema.parse(input);
  const tags = value.tagIds.map(findTaxonomyTag);
  if (tags.some(tag => !tag)) throw new Error('存在未知标签，请刷新后重试');
  const primary = tags.filter(tag => tag && isPrimaryTag(tag));
  if (!primary.length || primary.some(tag => !PRIMARY_TAG_SLUGS[value.categorySlug].includes(tag!.slug))) {
    throw new Error('具体类型与地点分类不一致');
  }
  const {longitude: lng, latitude: lat} = value;
  if ((lng === null) !== (lat === null)) throw new Error('经纬度需要一起填写');
  if (value.status === 'published' && (lng === null || lat === null)) throw new Error('发布前请选择地图地点');
  if (lng !== null && lat !== null && (lng < 113 || lng > 114.2 || lat < 21.8 || lat > 22.6)) {
    throw new Error('地点需要位于澳门或珠海服务范围内');
  }
  const seen = new Set<string>();
  return {...value, tagIds: [...new Set(value.tagIds)], searchKeywords: value.searchKeywords.filter(word => {
    const normalized = normalizeSearchText(word);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  })};
}

export const publishEditedSubmissionSchema = z.object({
  version: z.number().int().positive(), place: adminPlaceSchema,
  reviewNote: optionalText(1000).default(null)
}).strict();
