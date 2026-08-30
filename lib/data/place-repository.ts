import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import type {Place} from '../domain/place';

const categorySchema = z.enum(['food', 'shopping', 'entertainment', 'service']);
const regionSchema = z.enum(['macau-peninsula', 'taipa', 'coloane', 'hengqin', 'zhuhai', 'other']);
const tagKindSchema = z.enum(['category', 'cuisine', 'product', 'scene', 'facility', 'deal']);

const placeRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  name_en: z.string().trim().min(1).nullable().default(null),
  address: z.string().trim().min(1).nullable().default(null),
  category_slug: categorySchema,
  region: regionSchema.nullable().default(null),
  longitude: z.number().finite().min(-180).max(180).nullable().default(null),
  latitude: z.number().finite().min(-90).max(90).nullable().default(null),
  price_per_person: z.number().finite().min(0).nullable().default(null),
  rating_average: z.number().finite().min(1).max(5).nullable().default(null),
  review_count: z.number().int().min(0).default(0),
  confidence_score: z.number().finite().min(0).max(5).nullable().default(null),
  status: z.enum(['draft', 'published', 'archived']),
  published_at: z.string().nullable().default(null),
  created_at: z.string(),
  updated_at: z.string(),
  legacy_image_urls: z.array(z.string().url()).default([]),
  place_tags: z.array(
    z.object({
      tags: z.object({
        id: z.string().min(1),
        slug: z.string().min(1),
        kind: tagKindSchema,
        label_zh_mo: z.string().trim().min(1)
      })
    })
  ).default([]),
  place_media: z.array(
    z.object({
      id: z.string().min(1),
      public_url: z.string().url(),
      alt_text: z.string().trim().min(1).nullable().default(null),
      sort_order: z.number().int().default(0)
    })
  ).default([])
});

type ParsedPlaceRow = z.infer<typeof placeRowSchema>;

function formatValidationPath(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'row'}: ${issue.message}`)
    .join('; ');
}

export function mapPlaceRow(row: unknown): Place {
  const parsed = placeRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new Error(`Place row validation failed: ${formatValidationPath(parsed.error)}`);
  }

  const value: ParsedPlaceRow = parsed.data;
  const canonicalMedia = value.place_media
    .map((media) => ({
      id: media.id,
      url: media.public_url,
      altText: media.alt_text,
      sortOrder: media.sort_order
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const legacyMedia = canonicalMedia.length === 0
    ? value.legacy_image_urls.map((url, index) => ({
        id: `legacy:${value.id}:${index}`,
        url,
        altText: null,
        sortOrder: index
      }))
    : [];

  return {
    id: value.id,
    name: value.name,
    nameEn: value.name_en,
    address: value.address,
    category: value.category_slug,
    region: value.region,
    longitude: value.longitude,
    latitude: value.latitude,
    pricePerPerson: value.price_per_person,
    ratingAverage: value.rating_average,
    reviewCount: value.review_count,
    confidenceScore: value.confidence_score,
    tags: value.place_tags.map(({tags}) => ({
      id: tags.id,
      slug: tags.slug,
      kind: tags.kind,
      label: tags.label_zh_mo
    })),
    media: [...canonicalMedia, ...legacyMedia],
    status: value.status,
    publishedAt: value.published_at,
    createdAt: value.created_at,
    updatedAt: value.updated_at
  };
}

const PLACE_SELECT = `
  id,
  name,
  name_en,
  address,
  category_slug,
  region,
  longitude,
  latitude,
  price_per_person,
  rating_average,
  review_count,
  confidence_score,
  status,
  published_at,
  created_at,
  updated_at,
  legacy_image_urls,
  place_tags(tags(id, slug, kind, label_zh_mo)),
  place_media(id, bucket_id, storage_path, alt_text, sort_order)
`;

export async function findPublishedPlaceById(client: SupabaseClient, placeId: string): Promise<Place | null> {
  const {data, error} = await client
    .from('places')
    .select(PLACE_SELECT)
    .eq('id', placeId)
    .eq('status', 'published')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const raw = data as unknown as Record<string, unknown> & {
    place_media?: Array<{
      id: string;
      bucket_id: string;
      storage_path: string;
      alt_text: string | null;
      sort_order: number;
    }>;
  };
  const mediaWithUrls = (raw.place_media ?? []).map((media) => ({
    id: media.id,
    public_url: client.storage.from(media.bucket_id).getPublicUrl(media.storage_path).data.publicUrl,
    alt_text: media.alt_text,
    sort_order: media.sort_order
  }));

  return mapPlaceRow({...raw, place_media: mediaWithUrls});
}
