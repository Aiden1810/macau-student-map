import { z } from "zod";
import {
  assistantIntentSchema,
  type AssistantPlace,
  type AssistantOrigin,
} from "./contracts";
import { normalizeSearchText } from "../domain/taxonomy";

export const chatUnderstandingSchema = z
  .object({
    placeNames: z.array(z.string().trim().min(1).max(160)).max(4),
    originAction: z.enum(["keep", "current", "search"]),
    originQuery: z.string().trim().min(1).max(160).nullable(),
    intent: assistantIntentSchema,
  })
  .strict();
export type ChatUnderstanding = z.infer<typeof chatUnderstandingSchema>;
export const chatRequestSchema = z
  .object({
    messages: z.array(z.string().trim().min(1).max(1200)).min(1).max(6),
    locale: z.enum(["zh-CN", "zh-MO", "en"]).default("zh-CN"),
    context: z
      .object({
        places: z
          .array(
            z
              .object({
                name: z.string().max(160),
                address: z.string().max(500),
              })
              .strict(),
          )
          .max(4),
        originLabel: z.string().max(160).nullable(),
        pagePlaceId: z.uuid().optional(),
      })
      .strict(),
  })
  .strict();
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatPlaceGroup = { query: string; candidates: AssistantPlace[] };
export type ChatPlan = {
  mode: "ai";
  understanding: ChatUnderstanding;
  groups: ChatPlaceGroup[];
  catalogCandidates?: AssistantPlace[];
};

export function assistantPagePlaceId(pathname: string) {
  const match = /^\/shop\/([^/]+)\/?$/.exec(pathname);
  const parsed = z.uuid().safeParse(match?.[1]);
  return parsed.data;
}

export function referencedPagePlace(input: ChatRequest, catalog: readonly AssistantPlace[]) {
  const placeId = input.context.pagePlaceId;
  const message = input.messages.at(-1) ?? '';
  if (!placeId || !/这[家间間]|這[家間]|该餐厅|該餐廳|\bthis (?:place|restaurant|cafe|shop)\b/i.test(message)) return null;
  return catalog.find(place => place.id === placeId) ?? null;
}

export function chooseKnownChatPlace(
  group: ChatPlaceGroup,
  previous: AssistantPlace[],
  requiresCoordinates = false,
): AssistantPlace | null {
  let fresh =
    group.candidates.length === 1
      ? group.candidates[0]
      : group.candidates.find((candidate) =>
          previous.some(
            (old) =>
              (old.catalogId ?? old.id) === candidate.id &&
              normalizePlaceName(old.name) === normalizePlaceName(group.query),
          ),
        );
  if (fresh) {
    const freshId = fresh.id;
    const freshAddress = fresh.address;
    const confirmed = previous.find(
      (old) =>
        (old.catalogId ?? old.id) === freshId &&
        old.source === "catalog" &&
        old.coordinates &&
        normalizePlaceName(old.address) === normalizePlaceName(freshAddress),
    );
    if (!fresh.coordinates && confirmed)
      fresh = {
        ...fresh,
        coordinates: confirmed.coordinates,
        city: confirmed.city,
        source: "catalog",
      };
    return requiresCoordinates && !fresh.coordinates ? null : fresh;
  }
  if (group.candidates.length) return null;
  return (
    previous.find(
      (place) =>
        place.source === "amap" &&
        place.coordinates &&
        normalizePlaceName(place.name) === normalizePlaceName(group.query),
    ) ?? null
  );
}
export function resolveChatOrigin(
  action: ChatUnderstanding["originAction"],
  query: string | null,
  confirmed: AssistantOrigin | null,
) {
  if (action === "current") return { origin: null, query: "" };
  if (action === "search" && query) return { origin: null, query };
  return { origin: confirmed, query: null };
}

export const normalizePlaceName = (name: string) =>
  normalizeSearchText(name).replace(/[\s\p{P}\p{S}]+/gu, "");

export function selectCatalogForModel(catalog: AssistantPlace[], mentions: string[]) {
  const text = normalizePlaceName(mentions.join(" "));
  if (!text) return [];
  return catalog.flatMap(place => {
    const name = normalizePlaceName(place.name);
    if (name.length < 2) return [];
    let score = text.includes(name) ? name.length : 0;
    for (let size = Math.min(name.length - 1, 12); !score && size >= 2; size--) {
      for (let index = 0; index + size <= name.length; index++) {
        if (!text.includes(name.slice(index, index + size))) continue;
        score = size;
        break;
      }
    }
    return score ? [{place, score}] : [];
  }).sort((left, right) => right.score - left.score)
    .slice(0, 40).map(({place}) => place);
}

export function resolveChatPlaces(
  names: string[],
  catalog: AssistantPlace[],
): ChatPlaceGroup[] {
  const seen = new Set<string>();
  return names
    .filter((name) => {
      const key = normalizePlaceName(name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((query) => {
      const normalized = normalizePlaceName(query);
      const exact = catalog.filter(
        (place) => normalizePlaceName(place.name) === normalized,
      );
      const candidates = exact.length
        ? exact
        : normalized.length < 2
          ? []
          : catalog.filter((place) =>
              normalizePlaceName(place.name).includes(normalized),
            );
      return { query, candidates: candidates.slice(0, 8) };
    });
}
