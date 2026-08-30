import {z} from 'zod';

const nullableTrimmedText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .transform((value) => value || null);

// PostgreSQL accepts UUID-shaped values regardless of the RFC version nibble.
// The seeded taxonomy deliberately uses stable, human-auditable UUID values.
const postgresUuid = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Invalid UUID'
);

export const placeSubmissionDraftSchema = z
  .object({
    sourcePlaceId: postgresUuid.nullable().default(null),
    name: z.string().trim().min(1).max(120),
    address: nullableTrimmedText(500).default(null),
    categorySlug: z.enum(['food', 'shopping', 'entertainment', 'service']),
    region: nullableTrimmedText(80).default(null),
    longitude: z.number().min(-180).max(180).nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    pricePerPerson: z.number().min(0).max(100_000).nullable().default(null),
    tagIds: z.array(postgresUuid).max(20).default([]),
    notes: nullableTrimmedText(3000).default(null),
    version: z.number().int().positive().default(1)
  })
  .strict();

export type PlaceSubmissionDraftInput = z.infer<typeof placeSubmissionDraftSchema>;

export type PlaceSubmissionStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'merged';

export type PlaceSubmission = PlaceSubmissionDraftInput & {
  id: string;
  submittedBy: string;
  status: PlaceSubmissionStatus;
  submittedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};
