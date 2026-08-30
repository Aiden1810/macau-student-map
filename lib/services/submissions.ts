import type {PlaceSubmissionDraftInput} from '../domain/submission';
import {placeSubmissionDraftSchema} from '../domain/submission';
import {
  findTaxonomyTag,
  normalizeSearchText,
  type PlaceCategorySlug,
  type TaxonomyTag
} from '../domain/taxonomy';

export class SubmissionValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'SubmissionValidationError';
    this.field = field;
  }
}

const PRIMARY_SLUGS: Readonly<Record<PlaceCategorySlug, ReadonlySet<string>>> = {
  food: new Set([
    'chinese-cuisine',
    'portuguese-cuisine',
    'cha-chaan-teng',
    'hot-pot',
    'western-cuisine',
    'japanese-cuisine',
    'korean-cuisine',
    'barbecue',
    'snack',
    'fast-food',
    'southeast-asian-cuisine',
    'coffee',
    'milk-tea',
    'fruit-tea',
    'bread',
    'dessert',
    'cake',
    'burger',
    'fried-chicken'
  ]),
  shopping: new Set(['clothing', 'electronics', 'supermarket']),
  entertainment: new Set(['karaoke', 'cinema', 'board-games']),
  service: new Set(['printing', 'hair-salon', 'repair-service'])
};

const PRIMARY_KINDS = new Set<TaxonomyTag['kind']>(['category', 'cuisine', 'product']);

function validateTags(category: PlaceCategorySlug, tagIds: readonly string[]): string[] {
  if (tagIds.length === 0) {
    throw new SubmissionValidationError('tagIds', 'At least one canonical tag is required.');
  }

  const tags = tagIds.map((id) => findTaxonomyTag(id));
  if (tags.some((tag) => tag === null)) {
    throw new SubmissionValidationError('tagIds', 'Every tag must be a canonical tag.');
  }

  const primaryTags = (tags as TaxonomyTag[]).filter((tag) => PRIMARY_KINDS.has(tag.kind));
  if (primaryTags.some((tag) => !PRIMARY_SLUGS[category].has(tag.slug))) {
    throw new SubmissionValidationError('categorySlug', 'A selected primary tag conflicts with the category.');
  }

  return Array.from(new Set(tagIds));
}

export function prepareSubmissionForSubmit(input: PlaceSubmissionDraftInput) {
  const draft = placeSubmissionDraftSchema.parse(input);
  if (draft.longitude === null) {
    throw new SubmissionValidationError('longitude', 'Longitude is required before submission.');
  }
  if (draft.latitude === null) {
    throw new SubmissionValidationError('latitude', 'Latitude is required before submission.');
  }

  return {
    source_place_id: draft.sourcePlaceId,
    name: draft.name,
    address: draft.address,
    category_slug: draft.categorySlug,
    region: draft.region,
    longitude: draft.longitude,
    latitude: draft.latitude,
    price_per_person: draft.pricePerPerson,
    tag_ids: validateTags(draft.categorySlug, draft.tagIds),
    notes: draft.notes,
    status: 'pending' as const,
    submitted_at: new Date().toISOString(),
    version: draft.version + 1
  };
}

export function assertDraftOwner(draft: {submittedBy: string}, userId: string): void {
  if (draft.submittedBy !== userId) {
    throw new SubmissionValidationError('owner', 'Only the draft owner may change this submission.');
  }
}

export type DuplicateCandidateInput = {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
};

export type DuplicateCandidate = DuplicateCandidateInput & {distanceMeters: number};

function distanceMeters(
  left: {longitude: number; latitude: number},
  right: {longitude: number; latitude: number}
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function namesAreSimilar(left: string, right: string): boolean {
  const a = normalizeSearchText(left).replace(/[\s\p{P}\p{S}]/gu, '');
  const b = normalizeSearchText(right).replace(/[\s\p{P}\p{S}]/gu, '');
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function findDuplicateCandidates(
  draft: Pick<PlaceSubmissionDraftInput, 'name' | 'longitude' | 'latitude'>,
  places: readonly DuplicateCandidateInput[],
  radiusMeters = 200
): DuplicateCandidate[] {
  if (draft.longitude === null || draft.latitude === null) return [];

  return places
    .map((place) => ({
      ...place,
      distanceMeters: distanceMeters(
        {longitude: draft.longitude as number, latitude: draft.latitude as number},
        place
      )
    }))
    .filter(
      (place) => place.distanceMeters <= radiusMeters && namesAreSimilar(draft.name, place.name)
    )
    .sort((left, right) => left.distanceMeters - right.distanceMeters);
}
