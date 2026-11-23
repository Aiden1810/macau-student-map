
import {z} from 'zod';
import {placeIdSchema, poiIdSchema} from './search';

export const recommendationTarget = z.union([
  z.object({placeId: placeIdSchema}).strict(),
  z.object({poiId: poiIdSchema}).strict()
]);
export type RecommendationTarget = z.infer<typeof recommendationTarget>;
export const favoriteInput = z.object({poiId: poiIdSchema, saved: z.boolean()}).strict();
const spending = z.object({
  amount: z.number().min(0).max(100000).multipleOf(0.01),
  currency: z.enum(['MOP', 'HKD', 'CNY', 'USD', 'OTHER']),
  kind: z.enum(['per_person', 'total'])
}).strict();
export const recommendationInput = z.object({
  id: z.uuid(), target: recommendationTarget, reason: z.string().trim().min(1).max(3000),
  dishes: z.string().trim().max(200).optional(), scene: z.string().trim().max(100).optional(),
  spending: spending.optional(), hasImage: z.boolean()
}).strict();
export type RecommendationInput = z.infer<typeof recommendationInput>;
export const MEDIA_BUCKET = 'student-recommendation-media';
export const mediaTypes = ['image/jpeg', 'image/png', 'image/webp'];
export type PoiMetadata = {poi_id: string; current_poi_id: string | null; place_id: string | null; available: boolean; recommended: boolean};
export type PublicRecommendation = {
  id: string; reason: string; dishes: string | null; scene: string | null; amount: number | null;
  currency: string | null; amount_kind: 'per_person' | 'total' | null; image_path: string | null; created_at: string
};
export type OwnRecommendation = Pick<PublicRecommendation, 'id' | 'reason' | 'created_at'> & {status: 'pending' | 'approved' | 'rejected'};
export type FavoriteRow = {location_id: string; poi_id: string | null; place_id: string | null; created_at: string};

export function targetArgs(target: RecommendationTarget) {
  return {
    p_place: 'placeId' in target ? target.placeId : null,
    p_poi: 'poiId' in target ? target.poiId : null
  };
}
