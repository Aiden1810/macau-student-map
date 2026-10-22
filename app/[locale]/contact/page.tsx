import type {Metadata} from 'next';
import ContactForm from '@/components/ContactForm';
import {contactCopy} from '@/lib/contact/copy';
import {brandName} from '@/lib/brand';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: `${contactCopy(locale).title} · ${brandName(locale)}`};
}

export default function ContactPage() {
  return <ContactForm />;
}
