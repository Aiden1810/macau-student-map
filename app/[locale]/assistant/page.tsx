import {redirect} from 'next/navigation';

export default async function AssistantPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  redirect(`/${encodeURIComponent(locale)}?assistant=open`);
}
