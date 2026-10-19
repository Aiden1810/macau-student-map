import { describe, expect, it } from "vitest";
import { formatAssistantAnswer } from "../../../lib/assistant/answer";
import { assistantCopy } from "../../../lib/assistant/copy";
import { comparePlaces } from "../../../lib/assistant/decision";
import type {
  AssistantIntent,
  AssistantPlace,
  RouteSnapshot,
} from "../../../lib/assistant/contracts";
const place: AssistantPlace = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "面馆A",
  address: "横琴",
  category: "food",
  pricePerPerson: 28,
  tags: ["面食"],
  coordinates: [113.54, 22.14],
};
const intent: AssistantIntent = {
  intent: "recommend",
  budgetPerPerson: 40,
  totalBudget: null,
  currency: "CNY",
  partySize: 4,
  foods: ["面食"],
  excludedFoods: [],
  priority: "fastest",
  transport: "taxi",
};
const route: RouteSnapshot = {
  placeId: place.id,
  origin: [113.53, 22.13],
  destination: place.coordinates!,
  queriedAt: 1,
  source: "amap-js",
  taxi: {
    status: "ok",
    durationSeconds: 601,
    distanceMeters: 3000,
    lines: [],
    walkingMeters: null,
  },
  transit: { status: "no_route" },
};
describe("evidence-bound answer text", () => {
  it("shows actual route time, reference cost and the extracted group/budget", () => {
    const text = formatAssistantAnswer(
      comparePlaces([place], intent, [route]),
      intent,
      assistantCopy("zh-CN"),
      true,
    );
    expect(text).toContain("11");
    expect(text).toContain("112");
    expect(text).toContain("40");
    expect(text).toContain("面馆A");
  });
  it("asks for an origin for travel questions instead of making up times", () => {
    const next = { ...intent, intent: "travel_times" as const };
    expect(
      formatAssistantAnswer(
        comparePlaces([place], next, []),
        next,
        assistantCopy("en"),
        false,
      ),
    ).toBe(assistantCopy("en").chooseOrigin);
  });
});
