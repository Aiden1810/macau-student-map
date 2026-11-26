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
  it("uses the current published branch for an explicit reference to this restaurant", async () => {
    const currentId = "10000000-0000-4000-8000-000000000001";
    const otherId = "10000000-0000-4000-8000-000000000002";
    const first = {...(await deps().loadPlaces())[0], name: "南湾茶餐厅"};
    const handler = createPlaceChatHandler({
      ...deps(),
      loadPlaces: async () => [{...first, id: otherId}, {...first, id: currentId, address: "澳门"}],
      interpret: async () => ({...understanding, placeNames: [first.name]}),
    });
    const context = {...body.context, pagePlaceId: currentId};
    const referred = await handler(request({messages: ["从学校到这家怎么走？"], context}));
    expect(referred.status).toBe(200);
    expect((await referred.json()).data.groups[0].candidates.map((place: {id: string}) => place.id)).toEqual([currentId]);

    const byName = await handler(request({messages: ["从学校到南湾茶餐厅怎么走？"], context}));
    expect((await byName.json()).data.groups[0].candidates).toHaveLength(2);
  });
  it("returns only catalog candidates with verified budget facts when a recommendation has no named places", async () => {
    const d = deps();
    const candidate = (await d.loadPlaces())[0];
    const handler = createPlaceChatHandler({
      ...d,
      loadPlaces: async () => [candidate, {...candidate, id: "unknown", pricePerPerson: null}, {...candidate, id: "over", pricePerPerson: 41}],
      interpret: async () => ({...understanding, placeNames: [],
        intent: {...understanding.intent, intent: "recommend", budgetPerPerson: 40, maxWalkingMinutes: 15}
      }),
    });
    const response = await handler(request({messages: ["人均40，步行15分钟以内，吃什么？"], context: body.context}));
    const {data} = await response.json();
    expect(data.groups).toEqual([]);
    expect(data.catalogCandidates.map((place: {id: string}) => place.id)).toEqual([candidate.id]);
  });
});
