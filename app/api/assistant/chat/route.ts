import { createPlaceChatHandler } from "@/lib/api/place-chat-route";
import {instrumentApi} from '@/lib/observability/context';
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const POST = instrumentApi('assistant.chat',createPlaceChatHandler());
