import type {MetadataRoute} from 'next';

export const BRAND_MANIFEST_VERSION = '20261022brand1';
export const BRAND_ICON_VERSION = '20260413m4';

export function brandName(locale: string): string {
  return locale === 'en' ? 'Chengmi' : locale === 'zh-MO' ? '城覓' : '城觅';
}

export function createManifest(locale: string): MetadataRoute.Manifest {
  const language = ['zh-CN', 'zh-MO', 'en'].includes(locale) ? locale : 'zh-CN';
  return {
    name: brandName(language),
    short_name: brandName(language),
    description: language === 'en' ? 'A local life map for students in Macau' : language === 'zh-MO' ? '澳門學生本地生活地圖' : '澳门学生本地生活地图',
    start_url: `/${language}`,
    display: 'standalone',
    background_color: '#f8f9f5',
    theme_color: '#ffffff',
    lang: language,
    icons: [
      {src: `/icon?v=${BRAND_ICON_VERSION}`, sizes: '512x512', type: 'image/png'},
      {src: `/apple-icon?v=${BRAND_ICON_VERSION}`, sizes: '180x180', type: 'image/png'}
    ]
  };
}
