import {z} from 'zod';

export const reviewVersionSchema = z.string().datetime({offset: true});

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

export const reviewWriteSchema = reviewInputSchema.extend({
  expectedUpdatedAt: reviewVersionSchema.nullable().default(null)
});
export const reviewDeleteSchema = z.object({expectedUpdatedAt: reviewVersionSchema}).strict();
export const reviewModerationSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().trim().max(1000).nullable().default(null),
    expectedUpdatedAt: reviewVersionSchema
  })
  .strict()
  .refine((value) => value.decision !== 'rejected' || (value.reason?.length ?? 0) >= 3, {
    message: '请填写至少 3 字的隐藏原因',
    path: ['reason']
  });
export const REVIEW_PAGE_SIZE = 20;

export type Review = ReviewInput & {
  id: string;
  placeId: string;
  userId: string;
  status: 'pending' | 'published' | 'rejected';
  moderationStatus: 'pending' | 'approved' | 'rejected';
  moderationReason: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
