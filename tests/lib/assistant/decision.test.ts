import { describe, expect, it } from "vitest";
import {
  comparePlaces,
  validateRouteSnapshots,
} from "../../../lib/assistant/decision";
import {
  assistantRequestSchema,
  type AssistantIntent,
  type AssistantPlace,
  type RouteSnapshot,
} from "../../../lib/assistant/contracts";

const ids = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
];
const places: AssistantPlace[] = ids.map((id, i) => ({
  id,
  name: `店${i}`,
  address: "横琴",
  category: "food",
  pricePerPerson: i ? 80 : 28,
  tags: ["粉面"],
  coordinates: [113.54 + i / 100, 22.14],
}));
const intent: AssistantIntent = {
  intent: "recommend",
  budgetPerPerson: 40,
  totalBudget: null,
  currency: "CNY",
  partySize: 4,
  foods: ["粉面"],
  excludedFoods: [],
  priority: "balanced",
  transport: "either",
};
const origin = {
  coordinates: [113.53, 22.13] as [number, number],
  label: "出发地",
  city: "珠海" as const,
};
const snapshot: RouteSnapshot = {
  placeId: ids[0],
  origin: origin.coordinates,
  destination: places[0].coordinates!,
  queriedAt: 100_000,
  source: "amap-js",
  taxi: {
    status: "ok",
    durationSeconds: 600,
    distanceMeters: 3000,
    lines: [],
    walkingMeters: null,
  },
  transit: { status: "no_route" },
};

describe("selected-place decisions", () => {
  it("keeps services out of dining recommendations even without a cuisine constraint", () => {
    expect(
      comparePlaces(
        [{ ...places[0], category: "service" }],
        { ...intent, foods: [] },
        [],
      ).recommendedPlaceId,
    ).toBeNull();
  });
  it("matches narrow cuisine aliases in both inclusions and exclusions", () => {
    const hotpot = { ...places[0], name: "海底捞", tags: ["火鍋"] };
    expect(
      comparePlaces([hotpot], { ...intent, foods: ["hot pot"] }, [])
        .recommendedPlaceId,
    ).toBe(ids[0]);
    expect(
      comparePlaces(
        [hotpot],
        { ...intent, foods: [], excludedFoods: ["火锅"] },
        [],
      ).recommendedPlaceId,
    ).toBeNull();
  });
  it("never recommends a venue explicitly marked closed", () => {
    const closed = {
      ...places[0],
      name: "面馆（暂停营业）",
      pricePerPerson: 10,
    };
    expect(comparePlaces([closed], intent, []).recommendedPlaceId).toBeNull();
  });
  it("does not mistake bread for noodles", () => {
    expect(
      comparePlaces(
        [{ ...places[0], name: "面包店", tags: ["麵包"] }],
        intent,
        [],
      ).recommendedPlaceId,
    ).toBeNull();
  });
  it("cannot call an unknown price the cheapest", () => {
    expect(
      comparePlaces(
        [{ ...places[0], pricePerPerson: null }],
        { ...intent, budgetPerPerson: null, priority: "cheapest" },
        [],
      ).recommendedPlaceId,
    ).toBeNull();
  });
  it("recognizes noodles as a food group without matching unrelated Chinese food", () => {
    expect(
      comparePlaces(
        [{ ...places[0], name: "牛肉面馆", tags: ["中餐"] }],
        intent,
        [],
      ).recommendedPlaceId,
    ).toBe(ids[0]);
    expect(
      comparePlaces(
        [{ ...places[0], name: "鸡汤饭", tags: ["中餐"] }],
        intent,
        [],
      ).recommendedPlaceId,
    ).toBeNull();
  });
  it("filters over-budget choices and calculates reference party total", () => {
    const result = comparePlaces(places, intent, []);
    expect(result.recommendedPlaceId).toBe(ids[0]);
    expect(result.rows[0].groupTotal).toBe(112);
    expect(result.rows[1].budget).toBe("over");
  });
  it("does not choose a winner when everyone exceeds the budget", () => {
    expect(
      comparePlaces(places, { ...intent, budgetPerPerson: 10 }, []).reason,
    ).toBe("no_match");
    expect(
      comparePlaces(places, { ...intent, budgetPerPerson: 10 }, [])
        .recommendedPlaceId,
    ).toBeNull();
  });
  it("does not treat unknown prices as free, while preserving explicit zero", () => {
    const unknown = { ...places[0], pricePerPerson: null };
    expect(comparePlaces([unknown], intent, []).recommendedPlaceId).toBeNull();
    expect(
      comparePlaces([{ ...unknown, pricePerPerson: 0 }], intent, []).rows[0]
        .groupTotal,
    ).toBe(0);
  });
  it("never claims fastest when the required route failed", () => {
    expect(
      comparePlaces(
        places,
        { ...intent, priority: "fastest", transport: "transit" },
        [snapshot],
      ).reason,
    ).toBe("missing_routes");
  });
  it("limits fastest conclusions to routes actually returned", () => {
    const result = comparePlaces(
      places,
      {
        ...intent,
        budgetPerPerson: null,
        priority: "fastest",
        transport: "taxi",
      },
      [snapshot],
    );
    expect(result.recommendedPlaceId).toBe(ids[0]);
    expect(result.partialRoutes).toBe(true);
  });
  it("does not force a cuisine match or silently convert MOP to CNY", () => {
    expect(
      comparePlaces(places, { ...intent, foods: ["火锅"] }, []).reason,
    ).toBe("no_match");
    expect(
      comparePlaces(places, { ...intent, currency: "MOP" }, []).reason,
    ).toBe("currency");
  });
  it("asks for party size before converting a total budget", () => {
    expect(
      comparePlaces(
        places,
        { ...intent, budgetPerPerson: null, totalBudget: 200, partySize: null },
        [],
      ).reason,
    ).toBe("party_size");
    expect(
      comparePlaces(
        places,
        { ...intent, budgetPerPerson: null, totalBudget: 200 },
        [],
      ).budgetPerPerson,
    ).toBe(50);
  });
  it("rejects stale, future, wrong-origin and wrong-destination route evidence", () => {
    expect(
      validateRouteSnapshots([snapshot], places, origin, 110_000),
    ).toHaveLength(1);
    for (const invalid of [
      { ...snapshot, queriedAt: 1 },
      { ...snapshot, queriedAt: 300_000 },
      { ...snapshot, origin: [113.1, 22.1] as [number, number] },
      { ...snapshot, destination: [113.1, 22.1] as [number, number] },
    ]) {
      expect(
        validateRouteSnapshots([invalid], places, origin, 200_000),
      ).toEqual([]);
    }
  });
  it("bounds candidates/history and disallows fabricated successful routes", () => {
    expect(
      assistantRequestSchema.safeParse({
        placeIds: [ids[0], ids[0]],
        messages: ["推荐哪家"],
        origin: null,
        routes: [],
      }).success,
    ).toBe(false);
    expect(
      assistantRequestSchema.safeParse({
        placeIds: ids,
        messages: ["推荐哪家"],
        origin,
        routes: [{ ...snapshot, taxi: { status: "ok" } }],
      }).success,
    ).toBe(false);
  });
});
