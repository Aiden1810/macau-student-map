import { searchAmapPoiOptions, type AmapPoiOption } from "./place-search";
import { coordinatesSchema, type AssistantPlace } from "../assistant/contracts";
import { normalizePlaceName } from "../assistant/chat";

export async function searchChatMap(
  key: string,
  query: string,
  unnamed: string,
): Promise<AmapPoiOption[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      searchAmapPoiOptions(key, query, unnamed),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Map timeout")), 14000);
      }),
    ]).then((options) =>
      options.filter(
        (option) => coordinatesSchema.safeParse(option.coordinates).success,
      ),
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export function mapChatPlace(
  poi: AmapPoiOption,
  catalog?: AssistantPlace,
): AssistantPlace {
  const mapAddress = normalizePlaceName(poi.fullAddress);
  // A matching brand alone does not identify a branch. Keep POI IDs/addresses visible.
  if (
    catalog &&
    mapAddress.length >= 8 &&
    normalizePlaceName(catalog.address) === mapAddress &&
    normalizePlaceName(catalog.name) === normalizePlaceName(poi.name)
  )
    return {
      ...catalog,
      id: `poi:${poi.placeId}`,
      catalogId: catalog.id,
      address: poi.fullAddress,
      coordinates: poi.coordinates,
      city:
        poi.city === "macau" ? "澳门" : poi.city === "zhuhai" ? "珠海" : null,
      source: "catalog",
    };
  return {
    id: `poi:${poi.placeId}`,
    name: poi.name,
    address: poi.fullAddress,
    coordinates: poi.coordinates,
    city: poi.city === "macau" ? "澳门" : poi.city === "zhuhai" ? "珠海" : null,
    category: "unknown",
    pricePerPerson: null,
    tags: [],
    source: "amap",
  };
}
