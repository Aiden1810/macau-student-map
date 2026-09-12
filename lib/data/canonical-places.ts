import type {Shop} from '../../types/shop';

export type CanonicalPlacesListResult = {
  ok: boolean;
  items: Shop[];
};

export type CanonicalPlacesListLoader = () => Promise<CanonicalPlacesListResult>;

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
