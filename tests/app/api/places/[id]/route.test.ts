import {describe, expect, it} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createPlacesDetailGetHandler} from '../../../../../lib/api/places-detail-route';
import type {Place} from '../../../../../lib/domain/place';

function makePlace(overrides: Partial<Place> = {}): Place {
  return {
    id: 'place-1',
    name: '校園漢堡研究所',
    nameEn: 'Campus Burger Lab',
    address: '澳門氹仔大學大馬路',
    category: 'food',
    region: 'taipa',
    longitude: 113.5567,
    latitude: 22.1634,
    pricePerPerson: 58,
    ratingAverage: 4.5,
    reviewCount: 8,
    confidenceScore: 4.3077,
    tags: [{id: 'tag-burger', slug: 'burger', kind: 'product', label: '漢堡'}],
    media: [{id: 'media-1', url: 'https://example.com/cover.webp', altText: null, sortOrder: 1}],
    status: 'published',
    publishedAt: '2026-08-29T08:00:00.000Z',
    createdAt: '2026-08-28T08:00:00.000Z',
    updatedAt: '2026-08-29T08:00:00.000Z',
    ...overrides
  };
}

function createHandler(findPublishedPlace: (placeId: string) => Promise<Place | null>) {
  return createPlacesDetailGetHandler({
    createSupabaseClient: () => ({}) as unknown as SupabaseClient,
    findPublishedPlace: async (_client, placeId) => findPublishedPlace(placeId)
  });
}

async function callGet(handler: ReturnType<typeof createPlacesDetailGetHandler>, placeId = 'place-1') {
  return handler(new Request('http://localhost/api/places/place-1'), {
    params: Promise.resolve({id: placeId})
  });
}

describe('GET /api/places/[id]', () => {
  it('returns 200 with the mapped Shop when the published place exists', async () => {
    const handler = createHandler(async () => makePlace());

    const response = await callGet(handler);
    const body = (await response.json()) as {ok: boolean; data?: {id: string; name: string; category: string}};

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data?.id).toBe('place-1');
    expect(body.data?.name).toBe('校園漢堡研究所');
    expect(body.data?.category).toBe('food');
  });

  it('returns 404 NOT_FOUND when the published place does not exist', async () => {
    const handler = createHandler(async () => null);

    const response = await callGet(handler);
    const body = (await response.json()) as {ok: boolean; error: {code: string}};

    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it.each([
    {code: '42P01', message: 'relation "places" does not exist'},
    {code: 'PGRST205', message: "Could not find the table 'public.places' in the schema cache"},
    {code: 'PGRST200', message: 'could not find a relationship between "places" and "place_tags" in the schema cache'}
  ])('returns 503 SCHEMA_UNAVAILABLE for $code', async ({code, message}) => {
    const handler = createHandler(async () => {
      throw Object.assign(new Error(message), {code});
    });

    const response = await callGet(handler);
    const body = (await response.json()) as {ok: boolean; error: {code: string; message: string}};

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('SCHEMA_UNAVAILABLE');
  });

  it('does not classify permission or ordinary query errors as schema unavailable', async () => {
    const handler = createHandler(async () => {
      throw Object.assign(new Error('permission denied for table places'), {code: '42501'});
    });

    const response = await callGet(handler);
    const body = (await response.json()) as {ok: boolean; error: {code: string}};

    expect(response.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('returns 500 INTERNAL_ERROR for other database failures', async () => {
    const handler = createHandler(async () => {
      throw Object.assign(new Error('invalid input syntax for type uuid'), {code: '22P02'});
    });

    const response = await callGet(handler);
    const body = (await response.json()) as {ok: boolean; error: {code: string}};

    expect(response.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('returns 500 INTERNAL_ERROR when the database configuration is missing', async () => {
    const handler = createPlacesDetailGetHandler({
      createSupabaseClient: () => {
        throw new Error('Missing public Supabase configuration.');
      },
      findPublishedPlace: async () => makePlace()
    });

    const response = await callGet(handler);
    const body = (await response.json()) as {ok: boolean; error: {code: string; message: string}};

    expect(response.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('Public database configuration is missing.');
  });
});
