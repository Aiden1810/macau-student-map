import { afterEach, expect, it, vi } from "vitest";
import { understandPlaceChat } from "../../../lib/assistant/chat-model";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("extracts names and an origin in a single structured call without a selection form", async () => {
  const expected = {
    placeNames: ["二师兄猪脚饭", "穆味王"],
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
  vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
  const fetcher = vi.fn(async () =>
    Response.json({
      id: "test",
      object: "chat.completion",
      created: 1,
      model: "deepseek-flash",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: JSON.stringify(expected) },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const request = {
    messages: ["从保利国际广场到二师兄猪脚饭和穆味王，打车公交步行多久？"],
    locale: "zh-CN" as const,
    context: { places: [], originLabel: null },
  };
  expect(
    await understandPlaceChat(request, [], AbortSignal.timeout(2000)),
  ).toEqual(expected);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  const body = JSON.parse(String(options.body));
  expect(body.model).toBe("deepseek-flash");
  expect(body.response_format.type).toBe("json_object");
  expect(JSON.stringify(body)).not.toContain("test-key");
});
