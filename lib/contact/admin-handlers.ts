import {createAdminFeedbackHandlers} from '../api/feedback-routes';
import {createAuthenticatedSupabaseClient} from '../auth/require-user';
import {requireAdmin} from '../auth/require-admin';
import {countFeedback, listFeedback, updateFeedback} from './repository';

export const adminFeedbackHandlers = createAdminFeedbackHandlers({authorize: requireAdmin, client: createAuthenticatedSupabaseClient, list: listFeedback, count: countFeedback, update: updateFeedback});
