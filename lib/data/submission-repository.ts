import {z} from 'zod';
import type {PlaceSubmissionDraftInput} from '../domain/submission';

const submissionRowSchema = z.object({
  id: z.string(),
  source_place_id: z.string().nullable(),
  merged_into_place_id: z.string().nullable().optional(),
  name: z.string(),
  address: z.string().nullable(),
  category_slug: z.enum(['food', 'shopping', 'entertainment', 'service']),
  region: z.string().nullable(),
  longitude: z.number().nullable(),
  latitude: z.number().nullable(),
  price_per_person: z.coerce.number().nullable(),
  tag_ids: z.array(z.string()),
  notes: z.string().nullable(),
  status: z.enum(['draft', 'pending', 'approved', 'rejected', 'merged']),
  submitted_by: z.string(),
  version: z.number().int(),
  submitted_at: z.string().nullable(),
  reviewed_at: z.string().nullable().optional(),
  review_note: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

export type SubmissionRow = z.infer<typeof submissionRowSchema>;

export function mapSubmissionRow(input: unknown) {
  const row = submissionRowSchema.parse(input);
  return {
    id: row.id,
    sourcePlaceId: row.source_place_id,
    mergedIntoPlaceId: row.merged_into_place_id ?? null,
    name: row.name,
    address: row.address,
    categorySlug: row.category_slug,
    region: row.region,
    longitude: row.longitude,
    latitude: row.latitude,
    pricePerPerson: row.price_per_person,
    tagIds: row.tag_ids,
    notes: row.notes,
    status: row.status,
    submittedBy: row.submitted_by,
    version: row.version,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at ?? null,
    reviewNote: row.review_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
export function toDraftRow(input: PlaceSubmissionDraftInput, userId: string) {
  return {
    source_place_id: input.sourcePlaceId,
    name: input.name,
    address: input.address,
    category_slug: input.categorySlug,
    region: input.region,
    longitude: input.longitude,
    latitude: input.latitude,
    price_per_person: input.pricePerPerson,
    tag_ids: input.tagIds,
    notes: input.notes,
    status: 'draft' as const,
    submitted_by: userId,
    version: input.version
  };
}
