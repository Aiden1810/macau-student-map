export type LegacyFilterablePlace = {
  tags: readonly string[];
  region?: string | null;
};

/**
 * Applies one selected filter group to the legacy shop data used by the map.
 * Values inside the same group are alternatives (OR); separate groups are
 * applied one after another by the caller, which gives AND semantics.
 */
export function filterBySelectedFacet<T extends LegacyFilterablePlace>(
  selectedValues: readonly string[],
  places: readonly T[],
  facet: string,
): T[] {
  if (selectedValues.length === 0) {
    return [...places];
  }

  const selected = new Set(selectedValues);

  if (facet === 'region') {
    return places.filter((place) =>
      place.region ? selected.has(place.region) : false,
    );
  }

  return places.filter((place) =>
    place.tags.some((tag) => selected.has(tag)),
  );
}
