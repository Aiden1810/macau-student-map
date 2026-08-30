import {z} from 'zod';
import {parseJsonBody} from '@/lib/api/request';
import {createRequestId, errorResponse, successResponse} from '@/lib/api/result';
import {createAuthenticatedSupabaseClient, requireUser} from '@/lib/auth/require-user';
import {mapSubmissionRow} from '@/lib/data/submission-repository';
import {placeSubmissionDraftSchema} from '@/lib/domain/submission';
import {
  findDuplicateCandidates,
  prepareSubmissionForSubmit,
  SubmissionValidationError
} from '@/lib/services/submissions';

const submitSchema = z
  .object({
    confirmedDuplicateIds: z.array(z.string()).max(20).default([])
  })
  .strict();

const SUBMISSION_COLUMNS =
  'id,source_place_id,merged_into_place_id,name,address,category_slug,region,longitude,latitude,price_per_person,tag_ids,notes,status,submitted_by,version,submitted_at,reviewed_at,review_note,created_at,updated_at';

type RouteContext = {params: Promise<{id: string}>};

export async function POST(request: Request, {params}: RouteContext) {
  const requestId = createRequestId();
  const auth = await requireUser(request);
  if (!auth.ok) return errorResponse(auth.error, requestId);

  const body = await parseJsonBody(request, submitSchema);
  if (!body.ok) return errorResponse(body.error, requestId);

  const {id} = await params;
  const client = createAuthenticatedSupabaseClient(auth.accessToken);
  const {data: rawDraft, error: draftError} = await client
    .from('place_submissions')
    .select(SUBMISSION_COLUMNS)
    .eq('id', id)
    .eq('submitted_by', auth.user.id)
    .eq('status', 'draft')
    .maybeSingle();

  if (draftError) {
    console.error(`[${requestId}] load draft for submit failed:`, draftError.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to load the draft.', status: 500},
      requestId
    );
  }
  if (!rawDraft) {
    return errorResponse(
      {code: 'NOT_FOUND', message: 'An editable draft was not found.', status: 404},
      requestId
    );
  }

  const draft = mapSubmissionRow(rawDraft);
  const draftInput = placeSubmissionDraftSchema.parse({
    sourcePlaceId: draft.sourcePlaceId,
    name: draft.name,
    address: draft.address,
    categorySlug: draft.categorySlug,
    region: draft.region,
    longitude: draft.longitude,
    latitude: draft.latitude,
    pricePerPerson: draft.pricePerPerson,
    tagIds: draft.tagIds,
    notes: draft.notes,
    version: draft.version
  });

  let pendingRow: ReturnType<typeof prepareSubmissionForSubmit>;
  try {
    pendingRow = prepareSubmissionForSubmit(draftInput);
  } catch (error) {
    if (error instanceof SubmissionValidationError) {
      return errorResponse(
        {
          code: 'VALIDATION_ERROR',
          message: error.message,
          fieldErrors: {[error.field]: [error.message]},
          status: 422
        },
        requestId
      );
    }
    throw error;
  }

  const latitudeRadius = 0.002;
  const longitudeRadius = 0.0025;
  const {data: nearbyRows, error: nearbyError} = await client
    .from('places')
    .select('id,name,longitude,latitude')
    .eq('status', 'published')
    .gte('longitude', pendingRow.longitude - longitudeRadius)
    .lte('longitude', pendingRow.longitude + longitudeRadius)
    .gte('latitude', pendingRow.latitude - latitudeRadius)
    .lte('latitude', pendingRow.latitude + latitudeRadius)
    .limit(50);

  if (nearbyError) {
    console.error(`[${requestId}] duplicate lookup failed:`, nearbyError.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to check duplicate places.', status: 500},
      requestId
    );
  }

  const duplicateCandidates = findDuplicateCandidates(
    draftInput,
    (nearbyRows ?? []).filter(
      (row): row is {id: string; name: string; longitude: number; latitude: number} =>
        typeof row.id === 'string' &&
        typeof row.name === 'string' &&
        typeof row.longitude === 'number' &&
        typeof row.latitude === 'number'
    )
  );
  const confirmed = new Set(body.data.confirmedDuplicateIds);
  const unconfirmed = duplicateCandidates.filter((candidate) => !confirmed.has(candidate.id));

  if (unconfirmed.length > 0) {
    return successResponse(
      {submitted: false as const, duplicateCandidates: unconfirmed},
      {requestId}
    );
  }

  const {data: submitted, error: submitError} = await client
    .from('place_submissions')
    .update(pendingRow)
    .eq('id', id)
    .eq('submitted_by', auth.user.id)
    .eq('status', 'draft')
    .eq('version', draft.version)
    .select(SUBMISSION_COLUMNS)
    .maybeSingle();

  if (submitError) {
    console.error(`[${requestId}] submit draft failed:`, submitError.message);
    return errorResponse(
      {code: 'INTERNAL_ERROR', message: 'Unable to submit the draft.', status: 500},
      requestId
    );
  }
  if (!submitted) {
    return errorResponse(
      {code: 'CONFLICT', message: 'The draft changed before it could be submitted.', status: 409},
      requestId
    );
  }

  return successResponse(
    {submitted: true as const, submission: mapSubmissionRow(submitted)},
    {requestId}
  );
}
