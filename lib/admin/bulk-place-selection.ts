export const MAX_BULK_PLACES = 50;
export type BulkPlaceStatus = 'published' | 'archived';
export type BulkPlaceResult = {
  id: string; outcome: 'updated' | 'unchanged' | 'failed'; code?: string; message?: string;
};
export type BulkPlaceResponse = {results: BulkPlaceResult[]};

export function getSelectedBulkPlaces<T extends {id: string}>(selected: readonly string[], visible: readonly T[]): T[] {
  const ids = new Set(selected);
  return visible.filter(item => ids.has(item.id));
}

export function summarizeBulkResults(results: readonly BulkPlaceResult[]) {
  return {
    updated: results.filter(item => item.outcome === 'updated').length,
    unchanged: results.filter(item => item.outcome === 'unchanged').length,
    failed: results.filter(item => item.outcome === 'failed').length
  };
}
