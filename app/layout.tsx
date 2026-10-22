import type {Metadata, Viewport} from 'next';
import {brandName, BRAND_MANIFEST_VERSION, BRAND_ICON_VERSION} from '@/lib/brand';
import PwaRegister from '@/components/PwaRegister';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff'
};

export const metadata: Metadata = {
  applicationName: brandName('zh-CN'),
  title: brandName('zh-CN'),
  description: '澳门学生美食地图与探店推荐',
  manifest: `/manifest.webmanifest?v=${BRAND_MANIFEST_VERSION}`,
  icons: {
    icon: `/icon?v=${BRAND_ICON_VERSION}`,
    apple: `/apple-icon?v=${BRAND_ICON_VERSION}`
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: brandName('zh-CN')
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
