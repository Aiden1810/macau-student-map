import {normalizeSearchText, resolveTagAlias} from '../domain/taxonomy';

export type LegacyFilterablePlace = {
  tags: readonly string[];
  region?: string | null;
};

function canonicalTagKeys(value: string): string[] {
  const matchedSlugs = resolveTagAlias(value).map((tag) => tag.slug);
  if (matchedSlugs.length > 0) {
    return matchedSlugs;
  }

  return [normalizeSearchText(value)];
}

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

  if (facet === 'region') {
    const selected = new Set(selectedValues);
    return places.filter((place) =>
      place.region ? selected.has(place.region) : false,
    );
  }

  const selected = new Set(selectedValues.flatMap(canonicalTagKeys));

  return places.filter((place) =>
    place.tags.some((tag) => canonicalTagKeys(tag).some((key) => selected.has(key))),
  );
}
