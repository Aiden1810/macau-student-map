import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'zh-CN', 'zh-MO'],
  defaultLocale: 'zh-CN',
  localePrefix: 'always',
  localeCookie: {
    name: 'MU_MAP_LOCALE',
    sameSite: 'lax',
    path: '/'
  }
});
