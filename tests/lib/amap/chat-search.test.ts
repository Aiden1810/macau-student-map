import { describe, it, expect } from "vitest";
import { mapChatPlace } from "../../../lib/amap/chat-search";
const poi = {
  placeId: "map-id",
  name: "穆味王(横琴口岸店)",
  fullAddress: "珠海市横琴琴政路88号",
  city: "zhuhai" as const,
  coordinates: [113.54, 22.14] as [number, number],
};
const catalog = {
  id: "catalog-id",
  name: "穆味王（横琴口岸店）",
  address: poi.fullAddress,
  category: "food",
  pricePerPerson: 28,
  tags: ["粉面"],
  coordinates: null,
};
describe("conversation-only POI confirmation", () => {
  it("retains catalog facts when the explicitly confirmed map result has the exact branch name", () => {
    expect(mapChatPlace(poi, catalog)).toMatchObject({
      id: "poi:map-id",
      catalogId: "catalog-id",
      pricePerPerson: 28,
      category: "food",
      coordinates: poi.coordinates,
    });
    expect(catalog.coordinates).toBeNull();
  });
  it("does not transfer a price to another branch or an unrelated map result", () => {
    expect(
      mapChatPlace({ ...poi, name: "穆味王(华发店)" }, catalog),
    ).toMatchObject({
      pricePerPerson: null,
      category: "unknown",
      source: "amap",
    });
  });
  it("keeps same-name POIs distinguishable and does not link facts by name alone", () => {
    const other = {
      ...poi,
      placeId: "other",
      fullAddress: "珠海市南屏北山正街99号",
    };
    const a = mapChatPlace(poi, { ...catalog, address: "地址未确认" });
    const b = mapChatPlace(other, { ...catalog, address: "地址未确认" });
    expect(a.id).not.toBe(b.id);
    expect(b.address).toBe(other.fullAddress);
    expect(b.pricePerPerson).toBeNull();
  });
});
