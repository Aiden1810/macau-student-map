import {adminFeedbackHandlers} from '@/lib/contact/admin-handlers';

export async function PATCH(request: Request, {params}: {params: Promise<{id: string}>}) {
  return adminFeedbackHandlers.PATCH(request, (await params).id);
}
