import type {Metadata} from 'next';
import ContactForm from '@/components/ContactForm';
import {contactCopy} from '@/lib/contact/copy';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: `${contactCopy(locale).title} · 城觅 / CityU Food`};
}

export default function ContactPage() {
  return <ContactForm />;
}
