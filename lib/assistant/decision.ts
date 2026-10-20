import { normalizeSearchText, resolveTagAlias, resolveSearchTagAlias } from "../domain/taxonomy";
import type {
  AssistantDecision,
  AssistantIntent,
  AssistantOrigin,
  AssistantPlace,
  Coordinates,
  RouteSnapshot,
} from "./contracts";

const sameCoordinates = (a: Coordinates, b: Coordinates) =>
  Math.abs(a[0] - b[0]) < 0.00001 && Math.abs(a[1] - b[1]) < 0.00001;

export function validateRouteSnapshots(
  routes: RouteSnapshot[],
  places: AssistantPlace[],
  origin: AssistantOrigin | null,
  now = Date.now(),
): RouteSnapshot[] {
  if (!origin) return [];
  const seen = new Set<string>();
  return routes.filter((route) => {
    const place = places.find((p) => p.id === route.placeId);
    if (
      seen.has(route.placeId) ||
      !place?.coordinates ||
      !sameCoordinates(origin.coordinates, route.origin) ||
      !sameCoordinates(place.coordinates, route.destination) ||
      now - route.queriedAt > 120000 ||
      route.queriedAt > now + 10000
    )
      return false;
    seen.add(route.placeId);
    return true;
  });
}

function matchesFood(place: AssistantPlace, food: string): boolean {
  const haystack = normalizeSearchText([place.name, ...place.tags].join(" "));
  if (haystack.includes(normalizeSearchText(food))) return true;
  const aliases = resolveSearchTagAlias(food).filter(
    (tag) =>
      !tag.legacyLabels?.some(
        (label) => normalizeSearchText(label) === normalizeSearchText(food),
      ),
  );
  if (
    aliases.some((alias) =>
      place.tags.some((tag) =>
        resolveTagAlias(tag).some((t) => t.slug === alias.slug),
      ),
    )
  )
    return true;
  // Broad cuisine aliases must not turn a request for noodles into any Chinese meal.
  const noodleTerms = ["粉面", "粉麵", "面食", "麵食", "noodles"];
  return (
    noodleTerms.includes(normalizeSearchText(food)) &&
    /粉|面(?!包)|麵(?!包)|米线|米線|粿条|粿條|noodle/i.test(
      [place.name, ...place.tags].join(" "),
    )
  );
}

function travelSeconds(
  route: RouteSnapshot | null,
  transport: AssistantIntent["transport"],
): number | null {
  const modes =
    transport === "either"
      ? (["taxi", "transit", "walking"] as const)
      : [transport];
  const seconds = modes.flatMap((mode) =>
    route?.[mode]?.status === "ok" ? [route[mode].durationSeconds] : [],
  );
  return seconds.length ? Math.min(...seconds) : null;
}

export function comparePlaces(
  places: AssistantPlace[],
  intent: AssistantIntent,
  routes: RouteSnapshot[],
): AssistantDecision {
  const budget =
    intent.budgetPerPerson ??
    (intent.totalBudget !== null && intent.partySize
      ? intent.totalBudget / intent.partySize
      : null);
  const rows = places.map((place) => ({
    place,
    budget:
      budget === null
        ? ("no_limit" as const)
        : place.pricePerPerson === null
          ? ("unknown" as const)
          : place.pricePerPerson <= budget
            ? ("within" as const)
            : ("over" as const),
    foodMatches:
      (!intent.foods.length ||
        intent.foods.some((food) => matchesFood(place, food))) &&
      !intent.excludedFoods.some((food) => matchesFood(place, food)),
    groupTotal:
      place.pricePerPerson !== null && intent.partySize !== null
        ? Math.round(place.pricePerPerson * intent.partySize * 100) / 100
        : null,
    route: routes.find((route) => route.placeId === place.id) ?? null,
  }));
  const result: AssistantDecision = {
    recommendedPlaceId: null,
    reason: "no_match",
    budgetPerPerson: budget,
    partialRoutes: rows.some(
      (row) => travelSeconds(row.route, intent.transport) === null,
    ),
    rows,
  };
  if (
    (budget !== null || intent.totalBudget !== null) &&
    intent.currency === "MOP"
  )
    return { ...result, reason: "currency" };
  if (
    intent.totalBudget !== null &&
    intent.budgetPerPerson === null &&
    intent.partySize === null
  )
    return { ...result, reason: "party_size" };
  if (intent.intent === "travel_times" || intent.intent === "clarify")
    return { ...result, reason: intent.intent };
  let eligible = rows.filter(
    (row) =>
      row.place.category === "food" &&
      row.foodMatches &&
      row.budget !== "over" &&
      row.budget !== "unknown" &&
      !/暂停营业|暫停營業|已停业|已停業|已结业|已結業|permanently closed/i.test(
        row.place.name,
      ),
  );
  if (intent.priority === "cheapest")
    eligible = eligible.filter((row) => row.place.pricePerPerson !== null);
  if (!eligible.length) return result;
  if (intent.priority === "fastest") {
    eligible = eligible.filter(
      (row) => travelSeconds(row.route, intent.transport) !== null,
    );
    if (!eligible.length) return { ...result, reason: "missing_routes" };
  }
  const score = (row: (typeof rows)[number]) => {
    const price = row.place.pricePerPerson ?? 100000;
    const time = travelSeconds(row.route, intent.transport);
    if (intent.priority === "cheapest") return price;
    if (intent.priority === "fastest") return time ?? Infinity;
    return Math.min(price, 1000) / 10 + (time === null ? 30 : time / 120);
  };
  const winner = eligible
    .slice()
    .sort(
      (a, b) => score(a) - score(b) || a.place.id.localeCompare(b.place.id),
    )[0];
  return {
    ...result,
    recommendedPlaceId: winner.place.id,
    reason: "recommended",
  };
}
