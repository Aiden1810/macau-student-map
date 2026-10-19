import { describe, expect, it } from "vitest";
import {
  resolveChatPlaces,
  chatUnderstandingSchema,
  chooseKnownChatPlace,
  resolveChatOrigin,
} from "../../../lib/assistant/chat";
import type { AssistantPlace } from "../../../lib/assistant/contracts";

const places: AssistantPlace[] = [
  {
    id: "one",
    name: "穆味王（横琴口岸店）",
    address: "横琴",
    category: "food",
    pricePerPerson: 28,
    tags: [],
    coordinates: [113.54, 22.14],
  },
  {
    id: "two",
    name: "穆味王（华发悦天地店）",
    address: "华发",
    category: "food",
    pricePerPerson: 28,
    tags: [],
    coordinates: [113.53, 22.13],
  },
];
describe("chat destination resolution", () => {
  it("keeps a confirmed same-name branch by id while refreshing its facts", () => {
    const one = { ...places[0], name: "同名店", address: "地址一" };
    const two = { ...places[1], name: "同名店", address: "地址二" };
    expect(
      chooseKnownChatPlace(
        { query: "同名店", candidates: [one, { ...two, pricePerPerson: 35 }] },
        [two],
      )?.pricePerPerson,
    ).toBe(35);
    expect(
      chooseKnownChatPlace({ query: "同名店", candidates: [one, two] }, [])?.id,
    ).toBeUndefined();
  });
  it("allows dining facts without coordinates while requiring coordinates for route resolution", () => {
    const missing = { ...places[0], coordinates: null };
    expect(
      chooseKnownChatPlace({ query: missing.name, candidates: [missing] }, [])
        ?.pricePerPerson,
    ).toBe(28);
    expect(
      chooseKnownChatPlace(
        { query: missing.name, candidates: [missing] },
        [],
        true,
      ),
    ).toBeNull();
  });
  it("does not reuse unpublished/stale catalog records from an earlier answer", () => {
    expect(
      chooseKnownChatPlace({ query: places[0].name, candidates: [] }, places),
    ).toBeNull();
    const fresh = { ...places[0], pricePerPerson: 35 };
    expect(
      chooseKnownChatPlace({ query: fresh.name, candidates: [fresh] }, places)
        ?.pricePerPerson,
    ).toBe(35);
  });
  it("reuses only an already confirmed external POI when it is absent from the catalog", () => {
    const external = { ...places[0], source: "amap" as const };
    expect(
      chooseKnownChatPlace({ query: external.name, candidates: [] }, [external])
        ?.id,
    ).toBe(external.id);
  });
  it("clears a previous origin when a new location is explicitly requested", () => {
    const previous = {
      label: "旧起点",
      coordinates: [113.5, 22.1] as [number, number],
      city: "珠海" as const,
    };
    expect(resolveChatOrigin("current", null, previous)).toEqual({
      origin: null,
      query: "",
    });
    expect(resolveChatOrigin("keep", null, previous).origin).toBe(previous);
  });
  it("keeps branch ambiguity rather than choosing the first store", () => {
    expect(resolveChatPlaces(["穆味王"], places)[0].candidates).toHaveLength(2);
  });
  it("matches punctuation variants without dropping branch identity", () => {
    const groups = resolveChatPlaces(["穆味王(横琴口岸店)"], places);
    expect(groups[0].candidates.map((p) => p.id)).toEqual(["one"]);
  });
  it("does not match a food tag as a shop name or invent an absent store", () => {
    expect(
      resolveChatPlaces(["粉面", "不存在的店"], places).every(
        (g) => g.candidates.length === 0,
      ),
    ).toBe(true);
  });
  it("deduplicates repeated names without merging distinct branches", () => {
    expect(
      resolveChatPlaces(["穆味王", "穆味王", "穆味王(横琴口岸店)"], places),
    ).toHaveLength(2);
  });
  it("bounds extracted names and requires an explicit origin action", () => {
    expect(
      chatUnderstandingSchema.safeParse({
        placeNames: ["店1", "店2", "店3", "店4", "店5"],
      }).success,
    ).toBe(false);
  });
});
