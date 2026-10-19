import {z} from 'zod';

export const FEEDBACK_CATEGORIES = ['issue', 'correction', 'complaint', 'suggestion'] as const;
export const feedbackSchema = z.object({
  id: z.uuid(),
  category: z.enum(FEEDBACK_CATEGORIES),
  place: z.string().trim().max(200),
  message: z.string().trim().min(10).max(2000),
  replyTo: z.string().trim().max(200),
  locale: z.enum(['zh-CN', 'zh-MO', 'en'])
}).strict();
export const feedbackUpdateSchema = z.object({
  status: z.enum(['pending', 'resolved']),
  expectedStatus: z.enum(['pending', 'resolved'])
}).strict();
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type FeedbackWrite = FeedbackInput & {userId: string};
export type FeedbackStatus = z.infer<typeof feedbackUpdateSchema>['status'];
export type FeedbackFilter = FeedbackStatus | 'all';
export type FeedbackRecord = {
  id: string; user_id: string; category: FeedbackInput['category']; place: string; message: string;
  reply_to: string; locale: FeedbackInput['locale']; status: FeedbackStatus;
  created_at: string; handled_at: string | null; handled_by: string | null;
};
export const FEEDBACK_COLUMNS = 'id,user_id,category,place,message,reply_to,locale,status,created_at,handled_at,handled_by';
export const FEEDBACK_PAGE_SIZE = 20;

export type Feedback = {category: string; place: string; message: string; replyTo: string};

export function buildFeedbackText(feedback: Feedback, labels: {title: string; category: string; place: string; message: string; replyTo: string}) {
  return [labels.title, `${labels.category}: ${feedback.category.trim()}`,
    feedback.place.trim() ? `${labels.place}: ${feedback.place.trim()}` : '',
    `${labels.message}:\n${feedback.message.trim()}`,
    feedback.replyTo.trim() ? `${labels.replyTo}: ${feedback.replyTo.trim()}` : ''
  ].filter(Boolean).join('\n\n');
}

