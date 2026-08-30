import {z} from 'zod';

const reviewRowSchema = z.object({
  id: z.string(),
  place_id: z.string(),
  user_id: z.string(),
  rating: z.number().int().min(1).max(5),
  content: z.string().nullable(),
  status: z.enum(['pending', 'published', 'rejected']),
  created_at: z.string(),
  updated_at: z.string()
});

export function mapReviewRow(input: unknown) {
  const row = reviewRowSchema.parse(input);
  return {
    id: row.id,
    placeId: row.place_id,
    userId: row.user_id,
    rating: row.rating,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
