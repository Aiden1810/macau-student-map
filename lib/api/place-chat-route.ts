import {
  chatRequestSchema,
  chatUnderstandingSchema,
  resolveChatPlaces,
  type ChatRequest,
  type ChatUnderstanding,
} from "../assistant/chat";
import type { AssistantPlace } from "../assistant/contracts";
import { understandPlaceChat } from "../assistant/chat-model";
import { allowPaidRequest, loadPublishedPlaces } from "./place-assistant-route";
import { parseJsonBody } from "./request";
import { errorResponse, successResponse } from "./result";

type Dependencies = {
  isConfigured?: () => boolean;
  allowRequest?: (request: Request) => boolean;
  loadPlaces?: () => Promise<AssistantPlace[]>;
  interpret?: (
    input: ChatRequest,
    catalog: AssistantPlace[],
    signal: AbortSignal,
  ) => Promise<ChatUnderstanding>;
};
export function createPlaceChatHandler(deps: Dependencies = {}) {
  return async (request: Request) => {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return errorResponse({
        code: "FORBIDDEN",
        message: "请从本站发起请求。",
        status: 403,
      });
    const body = await parseJsonBody(request, chatRequestSchema, {
      maxBytes: 20000,
    });
    if (!body.ok) return errorResponse(body.error);
    if (
      !(
        deps.isConfigured ??
        (() => Boolean(process.env.DEEPSEEK_API_KEY?.trim()))
      )()
    )
      return successResponse({ mode: "unconfigured" });
    if (!(deps.allowRequest ?? allowPaidRequest)(request))
      return errorResponse({
        code: "CONFLICT",
        message: "请求较频繁，请稍后再试。",
        status: 429,
      });
    try {
      const catalog = await (
        deps.loadPlaces ?? (() => loadPublishedPlaces())
      )();
      const understanding = chatUnderstandingSchema.parse(
        await (deps.interpret ?? understandPlaceChat)(
          body.data,
          catalog,
          AbortSignal.any([request.signal, AbortSignal.timeout(20000)]),
        ),
      );
      return successResponse({
        mode: "ai",
        understanding,
        groups: resolveChatPlaces(understanding.placeNames, catalog),
      });
    } catch {
      return errorResponse({
        code: "INTERNAL_ERROR",
        message: "暂时未能完成分析，请重试。",
        status: 503,
      });
    }
  };
}
