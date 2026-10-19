import { describe, it, expect, vi } from "vitest";
import { createPlaceChatHandler } from "../../../lib/api/place-chat-route";
import type { ChatUnderstanding } from "../../../lib/assistant/chat";
const body = {
  messages: ["从保利国际广场到穆味王怎么去？"],
  context: { places: [], originLabel: null },
};
const request = (data: unknown = body) =>
  new Request("https://example.com/api/assistant/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://example.com",
    },
    body: JSON.stringify(data),
  });
const understanding: ChatUnderstanding = {
  placeNames: ["穆味王"],
  originAction: "search",
  originQuery: "保利国际广场",
  intent: {
    intent: "travel_times",
    budgetPerPerson: null,
    totalBudget: null,
    currency: "unspecified",
    partySize: null,
    foods: [],
    excludedFoods: [],
    priority: "balanced",
    transport: "either",
  },
};
const deps = () => ({
  isConfigured: () => true,
  allowRequest: () => true,
  loadPlaces: vi.fn(async () => [
    {
      id: "one",
      name: "穆味王(横琴口岸店)",
      address: "珠海",
      category: "food",
      pricePerPerson: 28,
      tags: [],
      coordinates: null,
    },
  ]),
  interpret: vi.fn(async () => understanding),
});
describe("chat recognition API", () => {
  it("accepts a message without preselected IDs and returns real catalog matches", async () => {
    const response = await createPlaceChatHandler(deps())(request());
    const { data } = await response.json();
    expect(response.status).toBe(200);
    expect(data.groups[0].candidates[0].pricePerPerson).toBe(28);
    expect(data.understanding.originQuery).toBe("保利国际广场");
  });
  it("does not bill a missing-Key request", async () => {
    const d = deps();
    d.isConfigured = () => false;
    expect(
      (await (await createPlaceChatHandler(d)(request())).json()).data.mode,
    ).toBe("unconfigured");
    expect(d.interpret).not.toHaveBeenCalled();
  });
  it("rejects precise origin coordinates or extra facts in the context", async () => {
    expect(
      (
        await createPlaceChatHandler(deps())(
          request({
            ...body,
            context: { ...body.context, coordinates: [113.5, 22.1] },
          }),
        )
      ).status,
    ).toBe(422);
  });
  it("does not expose upstream credentials when recognition fails", async () => {
    const d = deps();
    d.interpret = vi.fn(async () => {
      throw Error("secret-key");
    });
    const response = await createPlaceChatHandler(d)(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret-key");
  });
  it("does not invent a match for an unlisted shop", async () => {
    const d = deps();
    d.interpret = vi.fn(async () => ({
      ...understanding,
      placeNames: ["未收录面馆"],
    }));
    const { data } = await (await createPlaceChatHandler(d)(request())).json();
    expect(data.groups).toEqual([{ query: "未收录面馆", candidates: [] }]);
  });
});
