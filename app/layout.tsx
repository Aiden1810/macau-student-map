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
  applicationName: 'Lumen Map',
  title: 'Lumen Map',
  description: 'Discover great places around you',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Lumen Map'
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
