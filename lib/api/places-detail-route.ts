import {createClient, SupabaseClient} from '@supabase/supabase-js';
import {createRequestId, errorResponse, successResponse} from '../api/result';
import {findPublishedPlaceById} from '../data/place-repository';
import {mapPlaceToShop} from '../mappers/canonical-shop';
import {isMissingRelationError} from '../supabase/errors';
import type {Place} from '../domain/place';

export type RouteContext = {params: Promise<{id: string}>};

export type PlaceDetailDependencies = {
  createSupabaseClient?: () => SupabaseClient;
  findPublishedPlace?: (client: SupabaseClient, placeId: string) => Promise<Place | null>;
  isSchemaUnavailable?: (error: unknown) => boolean;
};

function createPublicSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing public Supabase configuration.');
  }
  return createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
}

/**
 * Factory keeps the route testable through dependency injection while the
 * route file wires the real database client and repository.
 */
export function createPlacesDetailGetHandler(dependencies: PlaceDetailDependencies = {}) {
  const createSupabaseClient = dependencies.createSupabaseClient ?? createPublicSupabaseClient;
  const findPublishedPlace = dependencies.findPublishedPlace ?? findPublishedPlaceById;
  const isSchemaUnavailable =
    dependencies.isSchemaUnavailable ??
    ((error: unknown) => isMissingRelationError(error as {code?: string; message?: string} | null));

  return async function GET(_request: Request, {params}: RouteContext) {
    const requestId = createRequestId();
    const {id: placeId} = await params;

    let client: SupabaseClient;
    try {
      client = createSupabaseClient();
    } catch {
      return errorResponse(
        {code: 'INTERNAL_ERROR', message: 'Public database configuration is missing.', status: 500},
        requestId
      );
    }

    let place: Place | null = null;
    try {
      place = await findPublishedPlace(client, placeId);
    } catch (error) {
      if (isSchemaUnavailable(error)) {
        return errorResponse(
          {code: 'SCHEMA_UNAVAILABLE', message: 'Canonical places schema is not yet available.', status: 503},
          requestId
        );
      }
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error(`[${requestId}] canonical place lookup failed:`, message);
      return errorResponse(
        {code: 'INTERNAL_ERROR', message: 'Unable to load the place.', status: 500},
        requestId
      );
    }

    if (!place) {
      return errorResponse(
        {code: 'NOT_FOUND', message: 'Published place not found.', status: 404},
        requestId
      );
    }

    return successResponse(mapPlaceToShop(place), {requestId});
  };
}
