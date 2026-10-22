import type {Shop} from '../../types/shop';

export type CanonicalPlacesListResult = {
  ok: boolean;
  items: Shop[];
};

export type CanonicalPlacesListLoader = () => Promise<CanonicalPlacesListResult>;

/** Preserve existing presentation while reading first publication from its authoritative source. */
export function mergeLegacyAndCanonicalPlaces(legacy: readonly Shop[], canonical: readonly Shop[]): Shop[] {
  const canonicalById = new Map(canonical.map(place => [place.id, place]));
  const legacyIds = new Set(legacy.map(place => place.id));
  return [
    ...legacy.map(place => canonicalById.has(place.id)
      ? {...place, publishedAt: canonicalById.get(place.id)!.publishedAt ?? null,
        ...(canonicalById.get(place.id)!.locationDetails ? {
          locationDetails: canonicalById.get(place.id)!.locationDetails,
          features: [...place.features.filter(feature => feature !== '小摊'), ...canonicalById.get(place.id)!.features.filter(feature => feature === '小摊')]
        } : {})}
      : place),
    ...canonical.filter(place => !legacyIds.has(place.id))
  ];
}

/**
 * Load the canonical place list, guarding against network rejections. A
 * transport failure or a non-ok payload both resolve to an empty list so the
 * discovery page still renders whatever the legacy `shops` query returned
 * instead of losing the whole list to one failing source.
 */
export async function loadCanonicalPlaces(loader: CanonicalPlacesListLoader): Promise<Shop[]> {
  try {
    const result = await loader();
    return result.ok ? result.items : [];
  } catch {
    return [];
  }
}
