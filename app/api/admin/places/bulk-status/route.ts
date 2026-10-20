import {createAdminPlaceRoute} from '@/lib/admin/api';
import {bulkPlaceStatusOperation} from '@/lib/admin/bulk-place-status';

export const POST = createAdminPlaceRoute<Record<string, never>>(bulkPlaceStatusOperation);
