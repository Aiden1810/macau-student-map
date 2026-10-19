import {createFeedbackPostHandler} from '@/lib/api/feedback-routes';
import {createAuthenticatedSupabaseClient, requireUser} from '@/lib/auth/require-user';
import {findOwnFeedback, insertFeedback} from '@/lib/contact/repository';

export const POST = createFeedbackPostHandler({authorize: requireUser, client: createAuthenticatedSupabaseClient, insert: insertFeedback, find: findOwnFeedback});
