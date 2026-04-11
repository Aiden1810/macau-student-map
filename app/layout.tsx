import type {Metadata, Viewport} from 'next';
import PwaRegister from '@/components/PwaRegister';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff'
};

export const metadata: Metadata = {
  applicationName: 'Macau Pulse',
  title: 'Macau Pulse',
  description: '澳门学生美食地图与探店推荐',
  manifest: '/manifest.webmanifest?v=20260410m3',
  icons: {
    icon: '/icon?v=20260410m3',
    apple: '/apple-icon?v=20260410m3'
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Macau Pulse'
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
