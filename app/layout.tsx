import type {Metadata, Viewport} from 'next';
import PwaRegister from '@/components/PwaRegister';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#006633'
};

export const metadata: Metadata = {
  applicationName: 'Macau Pulse',
  title: 'Macau Pulse',
  description: '澳门学生美食地图与探店推荐',
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
