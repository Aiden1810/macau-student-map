import type {MetadataRoute} from 'next';

const ICON_VERSION = '20260410m';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Macau Pulse',
    short_name: 'Macau Pulse',
    description: '澳门学生美食地图与探店推荐',
    start_url: '/',
    display: 'standalone',
    background_color: '#F4F7F6',
    theme_color: '#ffffff',
    lang: 'zh-CN',
    icons: [
      {
        src: `/icon?v=${ICON_VERSION}`,
        sizes: '512x512',
        type: 'image/png'
      },
      {
        src: `/apple-icon?v=${ICON_VERSION}`,
        sizes: '180x180',
        type: 'image/png'
      }
    ]
  };
}
