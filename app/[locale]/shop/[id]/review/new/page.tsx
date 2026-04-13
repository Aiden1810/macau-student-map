'use client';

import Image from 'next/image';
import {X} from 'lucide-react';
import {useParams, useRouter} from 'next/navigation';
import {useState} from 'react';
import ImageUpload from '@/components/ImageUpload';
import {supabase} from '@/lib/supabase';

export default function NewReviewPage() {
  const params = useParams<{id: string; locale: string}>();
  const router = useRouter();
  const shopId = String(params?.id ?? '');
  const locale = String(params?.locale ?? 'zh-CN');

  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleUploadImage = async (file: File) => {
    if (!shopId) {
      setError('店铺信息无效，暂时无法上传图片');
      return;
    }

    setUploadingImage(true);
    setError(null);
    setMessage(null);

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `comments/${shopId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const {error: uploadError} = await supabase.storage.from('shop-images').upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg'
      });

      if (uploadError) {
        throw uploadError;
      }

      const {data} = supabase.storage.from('shop-images').getPublicUrl(filePath);
      setImageUrls((prev) => [...prev, data.publicUrl]);
      setMessage('图片已添加');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '图片上传失败');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const submitComment = async () => {
    if (submitting || !shopId) {
      return;
    }

    const ensureSessionId = () => {
      if (typeof window === 'undefined') return null;
      const key = 'cityu_food_session_id';
      const existing = window.localStorage.getItem(key);
      if (existing) return existing;
      const next = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(key, next);
      return next;
    };

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const trimmedContent = content.trim();
      const payloadContent = trimmedContent.length > 0 ? trimmedContent : ' ';

      const {data: inserted, error: commentError} = await supabase
        .from('comments')
        .insert({
          shop_id: shopId,
          content: payloadContent,
          rating
        })
        .select('id')
        .single();

      if (commentError) {
        throw commentError;
      }

      if (imageUrls.length > 0) {
        const rows = imageUrls.map((url) => ({
          comment_id: inserted.id,
          image_url: url
        }));

        const {error: imageError} = await supabase.from('comment_images').insert(rows);

        if (imageError) {
          await supabase.from('comments').delete().eq('id', inserted.id);
          throw imageError;
        }
      }

      const sessionId = ensureSessionId();
      await supabase.from('shop_action_events').insert({
        shop_id: shopId,
        action_type: 'complaint_submit',
        session_id: sessionId,
        source: 'shop_detail_comment_rating',
        metadata: {rating}
      });

      setMessage('评论发布成功，正在返回店铺页...');
      router.push(`/${locale}/shop/${shopId}#reviews`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '评论发布失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">发表评论</h1>

        <div className="mt-3 flex items-center gap-1">
          {([1, 2, 3, 4, 5] as const).map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`rounded-md border px-2 py-1 text-sm transition ${star === rating ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {star}
            </button>
          ))}
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="可选：写下你的体验..."
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />

        <div className="mt-3">
          <ImageUpload onUpload={handleUploadImage} disabled={uploadingImage || submitting} buttonText="添加图片" />
        </div>

        {imageUrls.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {imageUrls.map((url, index) => (
              <div key={`${url}-${index}`} className="relative overflow-hidden rounded-lg border border-slate-200">
                <Image src={url} alt={`comment-image-${index + 1}`} width={200} height={200} className="h-24 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={submitComment}
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? '发布中...' : '发布'}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/${locale}/shop/${shopId}`)}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
          >
            返回
          </button>
        </div>

        {message && <p className="mt-3 text-sm text-emerald-600">{message}</p>}
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </section>
    </main>
  );
}
