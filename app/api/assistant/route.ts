import {createPlaceAssistantHandler} from '@/lib/api/place-assistant-route';
import {successResponse} from '@/lib/api/result';
import {instrumentApi} from '@/lib/observability/context';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const POST = instrumentApi('assistant.compare',createPlaceAssistantHandler());
export async function GET() {
  return successResponse({
    available: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
  });
}
