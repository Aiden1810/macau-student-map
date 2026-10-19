import {createPlaceAssistantHandler} from '@/lib/api/place-assistant-route';
import {successResponse} from '@/lib/api/result';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const POST = createPlaceAssistantHandler();
export async function GET() {
  return successResponse({
    available: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
  });
}
