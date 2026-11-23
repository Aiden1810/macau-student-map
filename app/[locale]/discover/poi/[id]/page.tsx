
import {notFound} from 'next/navigation';
import DiscoveryDetail from '@/components/discovery/DiscoveryDetail';
import {poiIdSchema} from '@/lib/discovery/search';

export default async function PoiDetailPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  if (!poiIdSchema.safeParse(id).success) notFound();
  return <DiscoveryDetail key={id} poiId={id} />;
}
