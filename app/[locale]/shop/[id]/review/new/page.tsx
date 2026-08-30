'use client';

import {useParams, useRouter} from 'next/navigation';
import ReviewForm from '@/components/reviews/ReviewForm';

export default function NewReviewPage() {
  const params = useParams<{id: string; locale: string}>();
  const router = useRouter();
  const placeId = String(params?.id ?? '');
  const locale = String(params?.locale ?? 'zh-MO');

  return (
    <main className="mx-auto max-w-xl px-4 py-5">
      <ReviewForm
        placeId={placeId}
        onSuccess={() => router.push(`/${locale}/shop/${placeId}#reviews`)}
        onCancel={() => router.push(`/${locale}/shop/${placeId}`)}
      />
    </main>
  );
}
