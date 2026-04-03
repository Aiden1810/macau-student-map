import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MU Map',
  description: 'Macau University Student Map MVP'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
