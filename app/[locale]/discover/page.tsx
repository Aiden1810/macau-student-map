
import DiscoveryMap from '@/components/discovery/DiscoveryMap';

import {poiPersistenceEnabled} from '@/lib/discovery/business-server';

export default function DiscoverPage() {
  return <DiscoveryMap canPersistPoi={poiPersistenceEnabled()} />;
}
