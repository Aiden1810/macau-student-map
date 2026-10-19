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
};

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
