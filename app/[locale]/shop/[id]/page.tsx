'use client';

import Image from 'next/image';
import {ImagePlus, X} from 'lucide-react';
import {useParams} from 'next/navigation';
import {useCallback, useEffect, useMemo, useState} from 'react';
import AdminImageManager from '@/components/AdminImageManager';
import ImageLightbox from '@/components/ImageLightbox';
import ImageUpload from '@/components/ImageUpload';
import MobileImageSlider from '@/components/MobileImageSlider';
import StarRating from '@/components/StarRating';
import {mapSingleShop} from '@/lib/mappers/shop';
import {getRatingTag} from '@/lib/utils/ratingTag';
import {supabase} from '@/lib/supabase';
import {Comment, Shop} from '@/types/shop';

type CommentWithImages = Comment & {
  comment_images: Array<{image_url: string}>;
};

function ShopImageGallery({
  imageUrls,
  onOpenLightbox
}: {
  imageUrls: string[];
  onOpenLightbox: (index: number) => void;
}) {
  const displayImages = imageUrls.filter((url) => url.trim().length > 0).slice(0, 5);

  if (displayImages.length === 0) {
    return (
      <div className="flex h-72 w-full items-center justify-center rounded-xl border border-slate-100 bg-gray-100">
        <svg
          viewBox="0 0 120 80"
          aria-hidden="true"
          className="h-20 w-28 text-gray-400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M14 33L20 18H100L106 33" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M18 33H102V64H18V33Z" stroke="currentColor" strokeWidth="4" />
          <path d="M30 64V47H48V64" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <rect x="58" y="43" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="4" />
          <rect x="78" y="43" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="4" />
        </svg>
      </div>
    );
  }

  if (displayImages.length === 1) {
    return (
      <button
        type="button"
        onClick={() => onOpenLightbox(0)}
        className="relative block h-80 w-full overflow-hidden rounded-xl border border-slate-100"
      >
        <Image src={displayImages[0]} alt="shop-main-image" fill className="object-cover" sizes="100vw" />
      </button>
    );
  }

  return (
    <div className="grid h-[420px] grid-cols-1 gap-2 overflow-hidden rounded-xl md:grid-cols-3">
      <button
        type="button"
        onClick={() => onOpenLightbox(0)}
        className="relative min-h-[220px] overflow-hidden md:col-span-2 md:row-span-2"
      >
        <Image src={displayImages[0]} alt="shop-image-1" fill className="object-cover" sizes="(min-width: 768px) 66vw, 100vw" />
      </button>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-2 md:grid-rows-2">
        {displayImages.slice(1).map((url, idx) => {
          const realIndex = idx + 1;
          const hiddenCount = displayImages.length - 5;
          const shouldShowMask = realIndex === 4 && hiddenCount > 0;

          return (
            <button
              key={`${url}-${realIndex}`}
              type="button"
              onClick={() => onOpenLightbox(realIndex)}
              className="relative min-h-[104px] overflow-hidden"
            >
              <Image src={url} alt={`shop-image-${realIndex + 1}`} fill className="object-cover" sizes="(min-width: 768px) 22vw, 50vw" />
              {shouldShowMask && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-xl font-semibold text-white">
                  +{hiddenCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ShopHero({
  shop,
  onOpenLightbox,
  onOpenAdminManager,
  canManageImages
}: {
  shop: Shop;
  onOpenLightbox: (index: number) => void;
  onOpenAdminManager: () => void;
  canManageImages: boolean;
}) {
  const averageScore = shop.rating;
  const ratingTag = getRatingTag(averageScore);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="block md:hidden">
        <MobileImageSlider images={shop.imageUrls ?? []} onOpenLightbox={onOpenLightbox} />
      </div>
      <div className="hidden md:block">
        <ShopImageGallery imageUrls={shop.imageUrls ?? []} onOpenLightbox={onOpenLightbox} />
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{shop.name}</h1>
          {canManageImages && (
            <button
              type="button"
              onClick={onOpenAdminManager}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              管理图片
            </button>
          )}
        </div>

        <p className="mt-1 text-sm text-slate-500">{shop.address}</p>
        <div className="mt-2 flex items-center gap-2">
          <StarRating score={averageScore} reviewCount={shop.reviews} />
          <span
            className={`rounded-md border px-2 py-1 text-xs font-semibold ${ratingTag.bgClass} ${ratingTag.textClass} ${ratingTag.borderClass}`}
          >
            {ratingTag.label}
          </span>
        </div>
      </div>
    </section>
  );
}

function PostComment({shopId, onPublished}: {shopId: string; onPublished: () => Promise<void> | void}) {
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleUploadImage = async (file: File) => {
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
    if (submitting) {
      return;
    }

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

      setContent('');
      setRating(5);
      setImageUrls([]);
      setMessage('评论发布成功');
      await onPublished();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '评论发布失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">发表评论</h2>

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
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
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
        {message && <p className="text-sm text-emerald-600">{message}</p>}
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </section>
  );
}

function CommentList({comments, loading, error}: {comments: CommentWithImages[]; loading: boolean; error: string | null}) {
  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">评论加载中...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div>;
  }

  return (
    <section className="space-y-4">
      {comments.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">还没有评论，来抢沙发吧。</div>
      ) : (
        comments.map((comment) => {
          const dateLabel = new Date(comment.createdAt).toLocaleString();

          return (
            <article key={comment.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <StarRating score={comment.rating} />
                <span className="text-xs text-slate-400">{dateLabel}</span>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{comment.content?.trim() ? comment.content : '用户仅打分，未填写文字评论。'}</p>

              {comment.comment_images.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {comment.comment_images.map((item, index) => (
                    <div key={`${comment.id}-${index}`} className="overflow-hidden rounded-lg border border-slate-100">
                      <Image
                        src={item.image_url}
                        alt={`comment-${comment.id}-image-${index + 1}`}
                        width={240}
                        height={240}
                        className="h-24 w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })
      )}
    </section>
  );
}

export default function ShopDetailPage() {
  const params = useParams<{id: string}>();
  const shopId = useMemo(() => String(params?.id ?? ''), [params]);

  const [shop, setShop] = useState<Shop | null>(null);
  const [shopLoading, setShopLoading] = useState(true);
  const [shopError, setShopError] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentWithImages[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isAdminImageManagerOpen, setIsAdminImageManagerOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const galleryImages = useMemo(
    () => (shop?.imageUrls ?? []).filter((url) => typeof url === 'string' && url.trim().length > 0),
    [shop?.imageUrls]
  );

  const fetchShop = useCallback(async () => {
    if (!shopId) {
      setShopError('店铺 ID 无效');
      setShopLoading(false);
      return;
    }

    setShopLoading(true);
    setShopError(null);

    const {data, error} = await supabase
      .from('shops')
      .select('id,name,address,image_urls,category,student_discount,tags,features,shop_type,rating_label,latitude,longitude,status,rating,review_count,total_sum,rating_count,review_text')
      .eq('id', shopId)
      .maybeSingle();

    setShopLoading(false);

    if (error) {
      setShopError(error.message);
      setShop(null);
      return;
    }

    if (!data) {
      setShopError('店铺不存在或已被删除');
      setShop(null);
      return;
    }

    setShop(mapSingleShop(data as Record<string, unknown>));
  }, [shopId]);

  const fetchComments = useCallback(async () => {
    setCommentsLoading(true);
    setCommentsError(null);

    const {data, error} = await supabase
      .from('comments')
      .select('id,shop_id,content,rating,created_at,comment_images(image_url)')
      .eq('shop_id', shopId)
      .order('created_at', {ascending: false});

    setCommentsLoading(false);

    if (error) {
      setCommentsError(error.message);
      setComments([]);
      return;
    }

    const normalized = (data ?? []).map((row) => ({
      id: String(row.id),
      shopId: String(row.shop_id),
      content: String(row.content ?? ''),
      rating: Number(row.rating ?? 0) as 1 | 2 | 3 | 4 | 5,
      createdAt: String(row.created_at),
      comment_images: Array.isArray(row.comment_images)
        ? row.comment_images
            .map((img) => ({image_url: String(img?.image_url ?? '')}))
            .filter((img) => img.image_url.trim().length > 0)
        : []
    }));

    setComments(normalized);
  }, [shopId]);

  const fetchAuthState = useCallback(async () => {
    const {data, error} = await supabase.auth.getUser();
    if (error || !data?.user) {
      setIsAuthenticated(false);
      return;
    }

    setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    void fetchShop();
    void fetchComments();
    void fetchAuthState();

    const {
      data: {subscription}
    } = supabase.auth.onAuthStateChange(() => {
      void fetchAuthState();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchShop, fetchComments, fetchAuthState]);

  if (shopLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate-500">加载中...</div>;
  }

  if (shopError || !shop) {
    return <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-rose-600">{shopError ?? '加载失败'}</div>;
  }

  return (
    <>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <ShopHero
          shop={shop}
          onOpenLightbox={(index) => {
            setLightboxIndex(index);
            setIsLightboxOpen(true);
          }}
          onOpenAdminManager={() => setIsAdminImageManagerOpen(true)}
          canManageImages={isAuthenticated}
        />

        <PostComment
          shopId={shop.id}
          onPublished={async () => {
            await Promise.all([fetchComments(), fetchShop()]);
          }}
        />

        <CommentList comments={comments} loading={commentsLoading} error={commentsError} />
      </main>

      <ImageLightbox
        images={galleryImages}
        currentIndex={lightboxIndex}
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        onChangeIndex={setLightboxIndex}
      />

      <AdminImageManager
        open={isAdminImageManagerOpen}
        shopId={shop.id}
        shopName={shop.name}
        imageUrls={shop.imageUrls ?? []}
        onClose={() => setIsAdminImageManagerOpen(false)}
        onUpdated={async () => {
          await fetchShop();
        }}
      />
    </>
  );
}
