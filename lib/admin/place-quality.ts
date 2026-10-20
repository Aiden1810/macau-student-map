import type {AdminPlaceRecord} from './place-editor';
import type {QualityFilter} from './operations';

export function matchesPlaceQuality(place: AdminPlaceRecord, filter: QualityFilter): boolean {
  if (filter === 'all') return true;
  if (place.status !== 'published') return false;
  if (filter === 'cover') return place.media.length === 0;
  if (filter === 'address') return !place.address?.trim();
  return place.longitude === null || place.latitude === null || !Number.isFinite(place.longitude) || !Number.isFinite(place.latitude);
}
