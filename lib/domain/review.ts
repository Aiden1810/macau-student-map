import {z} from 'zod';

export const reviewInputSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    content: z
      .string()
      .trim()
      .max(3000)
      .nullable()
      .default(null)
      .transform((value) => value || null)
  })
  .strict();

export type ReviewInput = z.infer<typeof reviewInputSchema>;

export type Review = ReviewInput & {
  id: string;
  placeId: string;
  userId: string;
  status: 'pending' | 'published' | 'rejected';
  createdAt: string;
  updatedAt: string;
};
