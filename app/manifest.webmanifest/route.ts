import {createManifest} from '@/lib/brand';

// Keep the original public URL without file-based metadata overriding locale links.
export function GET() {
  return Response.json(createManifest('zh-CN'), {headers: {'Content-Type': 'application/manifest+json'}});
}
