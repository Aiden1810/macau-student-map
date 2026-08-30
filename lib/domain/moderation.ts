import {z} from 'zod';

export const approveSubmissionSchema = z.object({reviewNote: z.string().trim().max(1000).nullable().default(null)}).strict();
export const mergeSubmissionSchema = z.object({
  targetPlaceId: z.string().min(1),
  reviewNote: z.string().trim().max(1000).nullable().default(null)
}).strict();
export const rejectSubmissionSchema = z.object({reviewNote: z.string().trim().min(3).max(1000)}).strict();
