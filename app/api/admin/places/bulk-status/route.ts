import {createAdminRoute} from '@/lib/admin/api';
import {bulkPlaceStatusOperation} from '@/lib/admin/bulk-place-status';

export const POST = createAdminRoute<Record<string, never>>(bulkPlaceStatusOperation);
