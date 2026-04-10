export type LocalSubmissionStatus = 'pending' | 'verified' | 'rejected';

export type LocalSubmissionRecord = {
  id: string;
  name: string;
  status: LocalSubmissionStatus;
  createdAt: string;
  isAnonymous: boolean;
  serverId?: string | null;
};

const LOCAL_SUBMISSIONS_KEY = 'cityu_food_local_submissions_v1';
const ANONYMOUS_SUBMITTER_KEY = 'cityu_food_anonymous_submitter_id';

function safeParse(value: string | null): LocalSubmissionRecord[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    const records: LocalSubmissionRecord[] = [];

    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;

      const record = item as Partial<LocalSubmissionRecord>;

      if (!record.id || !record.name || !record.status || !record.createdAt) {
        continue;
      }

      records.push({
        id: String(record.id),
        name: String(record.name),
        status: record.status,
        createdAt: String(record.createdAt),
        isAnonymous: Boolean(record.isAnonymous),
        serverId: record.serverId ? String(record.serverId) : null
      });
    }

    return records;
  } catch {
    return [];
  }
}

export function getAnonymousSubmitterId(): string | null {
  if (typeof window === 'undefined') return null;

  const existing = window.localStorage.getItem(ANONYMOUS_SUBMITTER_KEY);
  if (existing) return existing;

  const generated = `anon_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  window.localStorage.setItem(ANONYMOUS_SUBMITTER_KEY, generated);
  return generated;
}

export function readLocalSubmissions(): LocalSubmissionRecord[] {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(LOCAL_SUBMISSIONS_KEY));
}

export function writeLocalSubmissions(records: LocalSubmissionRecord[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(records.slice(0, 100)));
}

export function appendLocalSubmission(record: LocalSubmissionRecord): void {
  const current = readLocalSubmissions();
  const deduped = current.filter((item) => item.id !== record.id);
  writeLocalSubmissions([record, ...deduped]);
}

export function markLocalSubmissionServerId(localId: string, serverId: string): void {
  const current = readLocalSubmissions();
  const next = current.map((item) =>
    item.id === localId
      ? {
          ...item,
          serverId
        }
      : item
  );

  writeLocalSubmissions(next);
}
