import {NextIntlClientProvider, hasLocale} from 'next-intl';
import {getMessages} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {Toaster} from 'react-hot-toast';
import TrafficTracker from '@/components/TrafficTracker';
import {routing} from '@/i18n/routing';
import type {Metadata} from 'next';
import {brandName, BRAND_MANIFEST_VERSION} from '@/lib/brand';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  const name = brandName(locale);
  return {
    title: name,
    applicationName: name,
    manifest: `/${locale}/manifest.webmanifest?v=${BRAND_MANIFEST_VERSION}`,
    appleWebApp: {capable: true, statusBarStyle: 'default', title: name}
  };
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <TrafficTracker />
      {children}
      <Toaster
        position="bottom-center"
        containerStyle={{top: 'max(16px, env(safe-area-inset-top))'}}
        toastOptions={{
          duration: 2600,
          style: {
            borderRadius: '12px',
            border: '1px solid #d1d5db',
            background: '#ffffff',
            color: '#0f172a',
            fontSize: '14px'
          },
          success: {
            iconTheme: {
              primary: '#006633',
              secondary: '#ffffff'
            }
          },
          error: {
            iconTheme: {
              primary: '#dc2626',
              secondary: '#ffffff'
            }
          },
          loading: {
            iconTheme: {
              primary: '#FFCC00',
              secondary: '#006633'
            }
          }
        }}
      />
    </NextIntlClientProvider>
  );
}
