
import {notFound} from 'next/navigation';
import DiscoveryDetail from '@/components/discovery/DiscoveryDetail';
import {poiIdSchema} from '@/lib/discovery/search';

import {poiPersistenceEnabled} from '@/lib/discovery/business-server';

export default async function PoiDetailPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  if (!poiIdSchema.safeParse(id).success) notFound();
  return <DiscoveryDetail key={id} poiId={id} canPersistPoi={poiPersistenceEnabled()} />;
}
