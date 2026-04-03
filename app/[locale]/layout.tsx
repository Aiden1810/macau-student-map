import {NextIntlClientProvider, hasLocale} from 'next-intl';
import {getMessages} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {Toaster} from 'react-hot-toast';
import {routing} from '@/i18n/routing';

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
      {children}
      <Toaster
        position="bottom-center"
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
