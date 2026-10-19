import { z } from "zod";

export const coordinatesSchema = z.tuple([
  z.number().finite().min(113).max(114.2),
  z.number().finite().min(21.8).max(22.6),
]);
export type Coordinates = z.infer<typeof coordinatesSchema>;
export const originSchema = z
  .object({
    coordinates: coordinatesSchema,
    label: z.string().trim().min(1).max(160),
    city: z.enum(["澳门", "珠海"]),
  })
  .strict();
export type AssistantOrigin = z.infer<typeof originSchema>;
export const routeChoiceSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("ok"),
      durationSeconds: z.number().finite().min(0).max(172800),
      distanceMeters: z.number().finite().min(0).max(2000000),
      lines: z.array(z.string().max(120)).max(12),
      walkingMeters: z.number().finite().min(0).max(200000).nullable(),
    })
    .strict(),
  z
    .object({
      status: z.enum([
        "no_route",
        "timeout",
        "error",
        "missing_coordinates",
        "unknown_city",
      ]),
    })
    .strict(),
]);
export type RouteChoice = z.infer<typeof routeChoiceSchema>;
export const routeSnapshotSchema = z
  .object({
    placeId: z.string().uuid(),
    origin: coordinatesSchema,
    destination: coordinatesSchema,
    queriedAt: z.number().finite().nonnegative(),
    source: z.literal("amap-js"),
    taxi: routeChoiceSchema,
    transit: routeChoiceSchema,
    walking: routeChoiceSchema.optional(),
  })
  .strict();
export type RouteSnapshot = z.infer<typeof routeSnapshotSchema>;
export const assistantRequestSchema = z
  .object({
    placeIds: z
      .array(z.string().uuid())
      .min(1)
      .max(4)
      .refine((ids) => new Set(ids).size === ids.length),
    messages: z.array(z.string().trim().min(1).max(1200)).min(1).max(6),
    locale: z.enum(["zh-CN", "zh-MO", "en"]).default("zh-CN"),
    origin: originSchema.nullable(),
    routes: z.array(routeSnapshotSchema).max(4),
  })
  .strict();
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
export const assistantIntentSchema = z
  .object({
    intent: z.enum(["travel_times", "recommend", "clarify"]),
    budgetPerPerson: z.number().finite().min(0).max(100000).nullable(),
    totalBudget: z.number().finite().min(0).max(1000000).nullable(),
    currency: z.enum(["CNY", "MOP", "unspecified"]),
    partySize: z.number().int().min(1).max(100).nullable(),
    foods: z.array(z.string().trim().min(1).max(30)).max(8),
    excludedFoods: z.array(z.string().trim().min(1).max(30)).max(8),
    priority: z.enum(["fastest", "cheapest", "balanced"]),
    transport: z.enum(["taxi", "transit", "walking", "either"]),
  })
  .strict();
export type AssistantIntent = z.infer<typeof assistantIntentSchema>;
export type AssistantPlace = {
  id: string;
  name: string;
  address: string;
  category: string;
  pricePerPerson: number | null;
  tags: string[];
  coordinates: Coordinates | null;
  city?: AssistantOrigin["city"] | null;
  source?: "catalog" | "amap";
  catalogId?: string;
};
export type ComparisonRow = {
  place: AssistantPlace;
  budget: "within" | "over" | "unknown" | "no_limit";
  foodMatches: boolean;
  groupTotal: number | null;
  route: RouteSnapshot | null;
};
export type AssistantDecision = {
  recommendedPlaceId: string | null;
  reason:
    | "recommended"
    | "no_match"
    | "missing_routes"
    | "currency"
    | "party_size"
    | "travel_times"
    | "clarify";
  budgetPerPerson: number | null;
  partialRoutes: boolean;
  rows: ComparisonRow[];
};
export type AssistantResponse = {
  mode: "ai" | "unconfigured";
  intent?: AssistantIntent;
  decision?: AssistantDecision;
};
