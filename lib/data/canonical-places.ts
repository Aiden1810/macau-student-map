import type {Shop} from '../../types/shop';

export type CanonicalPlacesListResult = {
  ok: boolean;
  items: Shop[];
};

export type CanonicalPlacesListLoader = () => Promise<CanonicalPlacesListResult>;

/** Preserve legacy presentation, but use the current review summary and publication metadata. */
export function mergeLegacyAndCanonicalPlaces(legacy: readonly Shop[], canonical: readonly Shop[]): Shop[] {
  const canonicalById = new Map(canonical.map(place => [place.id, place]));
  const legacyIds = new Set(legacy.map(place => place.id));
  return [
    ...legacy.map(place => {
      const current = canonicalById.get(place.id);
      if (!current) return place;
      return {...place, publishedAt: current.publishedAt ?? null,
        rating: current.rating, reviews: current.reviews,
        ratingLabel: current.ratingLabel, recommendStatus: current.recommendStatus,
        ...(current.locationDetails ? {
          locationDetails: current.locationDetails,
          features: [...place.features.filter(feature => feature !== '小摊'), ...current.features.filter(feature => feature === '小摊')]
        } : {})};
    }),
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
