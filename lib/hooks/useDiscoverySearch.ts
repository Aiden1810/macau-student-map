
'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {discover} from '@/lib/discovery/client';
import {catalogArgs, type CatalogPlace} from '@/lib/discovery/catalog';
import type {PoiMetadata} from '@/lib/discovery/business';
import {createLatestDiscoveryRequest} from '@/lib/discovery/latest-request';
import {PAGE_SIZE, type DiscoveryQuery, type Poi, type SearchScope} from '@/lib/discovery/search';
import {supabase} from '@/lib/supabase';

type Search = Exclude<DiscoveryQuery, {kind: 'detail' | 'details'}>;
type Results = {
  pois: Poi[]; catalog: CatalogPlace[]; metadata: PoiMetadata[]; metadataError: boolean;
  amapMore: boolean; catalogMore: boolean; scope: SearchScope | null; catalogOffset: number;
};
const empty: Results = {pois: [], catalog: [], metadata: [], metadataError: false, amapMore: false, catalogMore: false, scope: null, catalogOffset: 0};

export function useDiscoverySearch() {
  const [result, setResult] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [loading, setLoading] = useState(false);
  const latest = useRef(createLatestDiscoveryRequest());
  const lastSuccess = useRef<{key: string; at: number} | null>(null);
  useEffect(() => {
    const request = latest.current;
    return () => request.cancel();
  }, []);

  const load = useCallback(async (query: Search, previous: Results = empty, sources = {amap: true, catalog: true}) => {
    const key = JSON.stringify([query, previous.catalogOffset, sources]);
    if (lastSuccess.current?.key === key && Date.now() - lastSuccess.current.at < 800) return null;
    const request = latest.current.begin(key);
    if (!request) return null;
    lastSuccess.current = null;
    const isNew = previous === empty;
    setLoading(true);
    setError(null);
    setCatalogError(false);
    if (isNew) setResult(empty);
    try {
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(21000)]);
      const amapTask = sources.amap ? discover(query, signal) : Promise.resolve(null);
      let scope: SearchScope | null = query.kind === 'area' ? null : query;
      const catalogTask = async (): Promise<CatalogPlace[] | null> => {
        if (!sources.catalog || !scope) return null;
        const {data, error} = await supabase.rpc('discovery_catalog', catalogArgs(scope, previous.catalogOffset)).abortSignal(signal);
        if (error) throw error;
        return data ?? [];
      };
      // A street search resolves the center first. All other searches run independently.
      let amap: PromiseSettledResult<Awaited<typeof amapTask>>;
      let catalog: PromiseSettledResult<Awaited<ReturnType<typeof catalogTask>>>;
      if (query.kind === 'area') {
        [amap] = await Promise.allSettled([amapTask]);
        if (amap.status === 'fulfilled') scope = amap.value?.resolvedScope ?? null;
        [catalog] = await Promise.allSettled([catalogTask()]);
      } else {
        [amap, catalog] = await Promise.allSettled([amapTask, catalogTask()]);
      }
      if (!request.current()) return null;
      const nextPois = amap.status === 'fulfilled' ? amap.value?.items ?? [] : [];
      const pois = [...new Map([...previous.pois, ...nextPois].map(poi => [poi.id, poi])).values()];
      const {data: metadata, error: metadataFailure} = pois.length === 0
        ? {data: [], error: null}
        : await supabase.rpc('discovery_poi_metadata', {p_ids: pois.map(poi => poi.id)}).abortSignal(signal);
      if (!request.current()) return null;

      const page = catalog.status === 'fulfilled' ? catalog.value : null;
      const nextCatalog = page?.slice(0, PAGE_SIZE) ?? [];
      setResult({
        pois,
        catalog: [...previous.catalog, ...nextCatalog],
        metadata: metadataFailure ? [] : (metadata ?? []),
        metadataError: Boolean(metadataFailure),
        catalogOffset: previous.catalogOffset + nextCatalog.length,
        scope: amap.status === 'rejected' && !isNew ? previous.scope : scope,
        amapMore: amap.status === 'rejected' ? previous.amapMore : amap.value?.hasMore ?? previous.amapMore,
        catalogMore: catalog.status === 'rejected' ? previous.catalogMore : (page ? page.length > PAGE_SIZE : previous.catalogMore)
      });
      if (amap.status === 'rejected') setError(amap.reason?.code ?? 'REQUEST_FAILED');
      if (catalog.status === 'rejected') setCatalogError(true);
      if (amap.status === 'fulfilled' && catalog.status === 'fulfilled' && !metadataFailure) lastSuccess.current = {key, at: Date.now()};
      if (isNew && amap.status === 'fulfilled') return amap.value?.resolvedScope ?? scope;
      return null;
    } catch {
      if (request.current()) setError('REQUEST_FAILED');
      return null;
    } finally {
      if (request.current()) setLoading(false);
      request.finish();
    }
  }, []);

  const nextPage = () => {
    if (loading || !result.scope) return;
    const query = {...result.scope, page: result.scope.page + (result.amapMore ? 1 : 0)};
    void load(query, result, {amap: result.amapMore, catalog: result.catalogMore});
  };

  return {result, error, catalogError, loading, load, nextPage};
}
