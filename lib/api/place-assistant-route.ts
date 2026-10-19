import { createClient } from "@supabase/supabase-js";
import {
  assistantIntentSchema,
  assistantRequestSchema,
  coordinatesSchema,
  type AssistantPlace,
  type AssistantIntent,
} from "../assistant/contracts";
import { comparePlaces, validateRouteSnapshots } from "../assistant/decision";
import { interpretPlaceQuestion } from "../assistant/model";
import { parseJsonBody } from "./request";
import { errorResponse, successResponse } from "./result";

const requestWindows = new Map<string, { start: number; count: number }>();
export function allowPaidRequest(request: Request): boolean {
  const now = Date.now();
  for (const [key, value] of requestWindows)
    if (now - value.start > 60000) requestWindows.delete(key);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const window = requestWindows.get(ip);
  if (!window) {
    if (requestWindows.size >= 10000) return false;
    requestWindows.set(ip, { start: now, count: 1 });
    return true;
  }
  if (window.count >= 8) return false;
  window.count++;
  return true;
}

export async function loadPublishedPlaces(
  ids?: string[],
): Promise<AssistantPlace[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Database not configured");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let query = client
    .from("places")
    .select(
      "id,name,address,category_slug,longitude,latitude,price_per_person,search_keywords_manual,place_tags(tags(label_zh_mo))",
    )
    .eq("status", "published");
  if (ids) query = query.in("id", ids);
  const { data, error } = await query.limit(200);
  if (error) throw error;
  const mapped = (data ?? []).map((row) => {
    const coordinates = coordinatesSchema.safeParse([
      row.longitude,
      row.latitude,
    ]);
    return {
      id: row.id,
      name: row.name,
      address: row.address ?? "",
      category: row.category_slug,
      pricePerPerson:
        row.price_per_person === null ? null : Number(row.price_per_person),
      coordinates: coordinates.success ? coordinates.data : null,
      tags: [
        ...(row.search_keywords_manual ?? []),
        ...(row.place_tags ?? []).flatMap((relation) => {
          const tags = relation.tags as unknown as {
            label_zh_mo: string;
          } | null;
          return tags ? [tags.label_zh_mo] : [];
        }),
      ],
    } satisfies AssistantPlace;
  });
  return ids
    ? ids.flatMap((id) => mapped.find((p) => p.id === id) ?? [])
    : mapped;
}

type Dependencies = {
  isConfigured?: () => boolean;
  loadPlaces?: (ids: string[]) => Promise<AssistantPlace[]>;
  interpret?: (
    messages: string[],
    places: AssistantPlace[],
    signal: AbortSignal,
    originLabel?: string | null,
  ) => Promise<AssistantIntent>;
  allowRequest?: (request: Request) => boolean;
};

export function createPlaceAssistantHandler(deps: Dependencies = {}) {
  return async function POST(request: Request) {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return errorResponse({
        code: "FORBIDDEN",
        message: "请从本站发起请求。",
        status: 403,
      });
    const body = await parseJsonBody(request, assistantRequestSchema, {
      maxBytes: 20000,
    });
    if (!body.ok) return errorResponse(body.error);
    if (
      !(
        deps.isConfigured ??
        (() => Boolean(process.env.DEEPSEEK_API_KEY?.trim()))
      )()
    )
      return successResponse({ mode: "unconfigured" as const });
    if (!(deps.allowRequest ?? allowPaidRequest)(request))
      return errorResponse({
        code: "CONFLICT",
        message: "请求较频繁，请稍后再试。",
        status: 429,
      });
    let places: AssistantPlace[];
    try {
      places = await (deps.loadPlaces ?? loadPublishedPlaces)(
        body.data.placeIds,
      );
    } catch {
      return errorResponse({
        code: "INTERNAL_ERROR",
        message: "暂时无法读取店铺，请稍后重试。",
        status: 503,
      });
    }
    if (
      places.length !== body.data.placeIds.length ||
      new Set(places.map((p) => p.id)).size !== places.length ||
      places.some((p) => !body.data.placeIds.includes(p.id))
    )
      return errorResponse({
        code: "NOT_FOUND",
        message: "所选店铺已下架或不存在，请重新选择。",
        status: 404,
      });
    try {
      const intent = assistantIntentSchema.parse(
        await (deps.interpret ?? interpretPlaceQuestion)(
          body.data.messages,
          places,
          AbortSignal.any([request.signal, AbortSignal.timeout(20000)]),
          body.data.origin?.label ?? null,
        ),
      );
      const routes = validateRouteSnapshots(
        body.data.routes,
        places,
        body.data.origin,
      );
      return successResponse({
        mode: "ai" as const,
        intent,
        decision: comparePlaces(places, intent, routes),
      });
    } catch {
      return errorResponse({
        code: "INTERNAL_ERROR",
        message: "AI 暂时未能完成分析，请重试；路线比较仍可使用。",
        status: 503,
      });
    }
  };
}
