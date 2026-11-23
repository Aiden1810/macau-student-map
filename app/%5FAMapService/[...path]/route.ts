import {createAmapProxy} from '@/lib/amap/security-proxy';

export const dynamic = 'force-dynamic';

export const GET = createAmapProxy({
  key: process.env.NEXT_PUBLIC_AMAP_WEB_KEY?.trim(),
  secret: process.env.AMAP_JS_SECURITY_CODE?.trim()
});
