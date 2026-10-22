import {createManifest} from '@/lib/brand';
import {routing} from '@/i18n/routing';

export async function GET(_request: Request, {params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!routing.locales.some(language => language === locale)) return new Response(null, {status: 404});
  return Response.json(createManifest(locale), {headers: {'Content-Type': 'application/manifest+json'}});
}
