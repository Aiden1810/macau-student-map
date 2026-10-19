import { describe, expect, it, vi } from "vitest";
import { createPlaceAssistantHandler } from "../../../lib/api/place-assistant-route";
import type { AssistantIntent } from "../../../lib/assistant/contracts";
const id = "00000000-0000-4000-8000-000000000001";
const input = {
  placeIds: [id],
  messages: ["四个人吃面，人均40以内"],
  origin: null,
  routes: [],
};
const intent: AssistantIntent = {
  intent: "recommend",
  budgetPerPerson: 40,
  totalBudget: null,
  currency: "CNY",
  partySize: 4,
  foods: ["面"],
  excludedFoods: [],
  priority: "balanced",
  transport: "either",
};
const place = {
  id,
  name: "真实面馆",
  address: "珠海",
  category: "food",
  pricePerPerson: 28,
  tags: ["面"],
  coordinates: null,
};
const request = (data: unknown = input) =>
  new Request("https://example.com/api/assistant", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://example.com",
    },
    body: JSON.stringify(data),
  });
const dependencies = () => ({
  isConfigured: () => true,
  allowRequest: () => true,
  loadPlaces: vi.fn(async () => [place]),
  interpret: vi.fn(async () => intent),
});

describe("place assistant API", () => {
  it("returns setup state without billing or reading data when Key is absent", async () => {
    const deps = dependencies();
    deps.isConfigured = () => false;
    const response = await createPlaceAssistantHandler(deps)(request());
    expect((await response.json()).data.mode).toBe("unconfigured");
    expect(deps.loadPlaces).not.toHaveBeenCalled();
    expect(deps.interpret).not.toHaveBeenCalled();
  });
  it("uses server-side prices and facts for recommendations", async () => {
    const response =
      await createPlaceAssistantHandler(dependencies())(request());
    const data = (await response.json()).data;
    expect(data.mode).toBe("ai");
    expect(data.decision.recommendedPlaceId).toBe(id);
    expect(data.decision.rows[0].groupTotal).toBe(112);
  });
  it("does not call a model for missing/unpublished/duplicate candidates", async () => {
    const deps = dependencies();
    deps.loadPlaces = vi.fn(async () => []);
    expect((await createPlaceAssistantHandler(deps)(request())).status).toBe(
      404,
    );
    expect(deps.interpret).not.toHaveBeenCalled();
    expect(
      (
        await createPlaceAssistantHandler(deps)(
          request({ ...input, placeIds: [id, id] }),
        )
      ).status,
    ).toBe(422);
  });
  it("rejects cross-origin requests and throttles paid requests", async () => {
    const deps = dependencies();
    deps.allowRequest = () => false;
    expect((await createPlaceAssistantHandler(deps)(request())).status).toBe(
      429,
    );
    const cross = new Request("https://example.com/api/assistant", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      body: JSON.stringify(input),
    });
    expect(
      (await createPlaceAssistantHandler(dependencies())(cross)).status,
    ).toBe(403);
  });
  it("does not echo provider errors or credentials to the browser", async () => {
    const deps = dependencies();
    deps.interpret = vi.fn(async () => {
      throw new Error("secret-api-key upstream");
    });
    const response = await createPlaceAssistantHandler(deps)(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret-api-key");
  });
  it("rejects malformed model output instead of inventing a fallback answer", async () => {
    const deps = dependencies();
    deps.interpret = vi.fn(async () => ({ ...intent, partySize: -10 }));
    expect((await createPlaceAssistantHandler(deps)(request())).status).toBe(
      503,
    );
  });
});
