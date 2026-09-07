import type {AdminAuthResult} from '../auth/require-admin';
import {createRequestId, errorResponse, successResponse} from './result';
import {mapSubmissionRow} from '../data/submission-repository';

export type AdminSubmissionStatus = 'pending' | 'approved' | 'merged' | 'rejected';

type QueryError = {message: string};
type ListResult = {data: unknown[] | null; error: QueryError | null};
type CountResult = {count: number | null; error: QueryError | null};

type AdminSubmissionsDependencies<Client> = {
  requireAdmin: (request: Request) => Promise<AdminAuthResult>;
  createClient: (accessToken: string) => Client;
  listPending: (client: Client) => Promise<ListResult>;
  countByStatus: (client: Client, status: AdminSubmissionStatus) => Promise<CountResult>;
};

const MODERATION_STATUSES: readonly AdminSubmissionStatus[] = [
  'pending',
  'approved',
  'merged',
  'rejected'
];

function preventCaching(response: Response): Response {
  response.headers.set('cache-control', 'private, no-store');
  return response;
}

export function createAdminSubmissionsGetHandler<Client>(
  dependencies: AdminSubmissionsDependencies<Client>
) {
  return async function GET(request: Request): Promise<Response> {
    const requestId = createRequestId();
    const auth = await dependencies.requireAdmin(request);
    if (!auth.ok) return preventCaching(errorResponse(auth.error, requestId));

    const client = dependencies.createClient(auth.accessToken);
    const [itemsResult, ...countResults] = await Promise.all([
      dependencies.listPending(client),
      ...MODERATION_STATUSES.map((status) => dependencies.countByStatus(client, status))
    ]);

    const failedCountIndex = countResults.findIndex(
      (result) => result.error !== null || typeof result.count !== 'number'
    );
    const queryError =
      itemsResult.error ??
      (failedCountIndex >= 0
        ? countResults[failedCountIndex].error ?? {
            message: `${MODERATION_STATUSES[failedCountIndex]} count was unavailable`
          }
        : null);

    if (queryError) {
      console.error(`[${requestId}] admin submission queue failed:`, queryError.message);
      return preventCaching(
        errorResponse(
          {code: 'INTERNAL_ERROR', message: 'Unable to load the moderation queue.', status: 500},
          requestId
        )
      );
    }

    const stats = Object.fromEntries(
      MODERATION_STATUSES.map((status, index) => [status, countResults[index].count as number])
    ) as Record<AdminSubmissionStatus, number>;
    const response = successResponse(
      {items: (itemsResult.data ?? []).map(mapSubmissionRow), stats},
      {requestId}
    );
    return preventCaching(response);
  };
}
