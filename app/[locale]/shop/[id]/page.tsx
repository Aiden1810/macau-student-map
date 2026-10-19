'use client';

import Image from 'next/image';
import Link from 'next/link';
import {ArrowLeft, Heart, ImagePlus, MapPin, MessageCircle, MessageCirclePlus, Phone} from 'lucide-react';
import {useParams} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import AdminImageManager from '@/components/AdminImageManager';
import ImageLightbox from '@/components/ImageLightbox';
import MobileImageSlider from '@/components/MobileImageSlider';
import PlaceNavigationActions from '@/components/PlaceNavigationActions';
import PlaceTypeBadge from '@/components/PlaceTypeBadge';
import {formatPlacePrice} from '@/lib/domain/place-types';
import StarRating from '@/components/StarRating';
import {createRequestGuard, runLatest} from '@/lib/data/async-request';
import {loadAuthRole} from '@/lib/data/auth-role';
import {loadComments} from '@/lib/data/comments';
import type {ReviewRow} from '@/lib/data/comments';
import ReviewForm from '@/components/reviews/ReviewForm';
import {canManageLegacyImages, loadShopDetail} from '@/lib/data/shop-detail';
import type {ShopSource} from '@/lib/data/shop-detail';
import {mapSingleShop} from '@/lib/mappers/shop';
import {resolvePriceDisplay} from '@/lib/utils/price';
import {useFavorites} from '@/lib/hooks/useFavorites';
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
  const t = useTranslations('ShopDetail');
  const price = resolvePriceDisplay(shop.pricePerPerson);
  const branch = /^(.*?)\s*[（(]([^（）()]+)[）)]$/.exec(shop.name);
  const phone = shop.phone?.trim();
  const hasRating = shop.reviews > 0 && shop.rating > 0;
  const tags = [...new Set(shop.tags.map(tag => tag.trim()).filter(Boolean))];
  return (
    <section>
      <div className="md:hidden"><MobileImageSlider images={shop.imageUrls ?? []} onOpenLightbox={onOpenLightbox} /></div>
      <div className="hidden md:block"><ShopImageGallery imageUrls={shop.imageUrls ?? []} onOpenLightbox={onOpenLightbox} /></div>
      <div className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="break-words text-[25px] font-semibold leading-[1.35] tracking-tight text-ink md:text-3xl">{branch ? <>{branch[1]}<span className="mt-1 block text-lg font-normal tracking-normal text-muted">({branch[2]})</span></> : shop.name}</h1>
          {canManageImages && <button type="button" onClick={onOpenAdminManager} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-line bg-white px-3 text-xs font-medium text-pine-700"><ImagePlus size={16} aria-hidden="true" />管理图片</button>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted"><PlaceTypeBadge place={shop} />{shop.region && <span>· {shop.region}</span>}</div>
        <div className="mt-4 text-ink">
          {price.kind === 'paid' ? <p className="flex flex-wrap items-baseline gap-2"><span className="text-3xl font-semibold tracking-tight">¥{price.value}</span><span className="text-sm text-muted">{t(shop.category === 'food' || shop.category === 'drink' ? 'priceUnit' : 'servicePriceUnit')}</span></p> : <p className="text-base font-medium text-muted">{formatPlacePrice(shop)}</p>}
        </div>
        <div className="mt-3">{hasRating ? <StarRating score={shop.rating} reviewCount={shop.reviews} /> : <p className="text-sm text-muted">暂无评价</p>}</div>
        {tags.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{tags.map(tag => <span key={tag} className="rounded-lg bg-[#eeefeb] px-2.5 py-1.5 text-xs text-muted">{tag}</span>)}</div>}
        {shop.studentDiscount?.trim() && <p className="mt-4 rounded-xl bg-pine-50 p-3 text-sm leading-6 text-pine-800">{shop.studentDiscount}</p>}
        <div className="mt-6 rounded-2xl border border-line bg-white p-4">
          <div className="flex items-start gap-3"><MapPin size={19} aria-hidden="true" className="mt-0.5 shrink-0 text-pine-700" /><div className="min-w-0"><h2 className="text-xs text-muted">{t('address')}</h2><p className="mt-1 break-words text-sm leading-6 text-ink">{shop.address || '地址待补充'}</p></div></div>
          {phone && <a href={`tel:${phone.replace(/\s+/g, '')}`} className="mt-3 inline-flex min-h-11 items-center gap-2 border-t border-line pt-3 text-sm font-medium text-pine-700"><Phone size={16} aria-hidden="true" />{phone}</a>}
          <div className="mt-4 hidden border-t border-line pt-4 md:block"><PlaceNavigationActions key={shop.id} place={shop} /></div>
        </div>
      </div>
    </section>
  );
}


function CommentList({comments, loading, error}: {comments: CommentWithImages[]; loading: boolean; error: string | null}) {
  const t = useTranslations('ShopDetail');
  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">评论加载中...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div>;
  }

  return (
    <section id="reviews" className="scroll-mt-20 space-y-4">
      {comments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-[#eeefeb]/60 px-4 py-7 text-center text-muted"><MessageCircle size={28} strokeWidth={1.4} aria-hidden="true" /><p className="text-sm">{t('emptyReviews')}</p></div>
      ) : (
        comments.map((comment) => {
          const dateLabel = new Date(comment.updatedAt ?? comment.createdAt).toLocaleString();

          return (
            <article key={comment.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <StarRating score={comment.rating} />
                <span className="text-xs text-slate-400">{comment.updatedAt&&comment.updatedAt!==comment.createdAt?'更新于 ':''}{dateLabel}</span>
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
  const locale = useLocale();
  const t = useTranslations('ShopDetail');
  const {favorites, toggleFavorite, isLoaded: favoritesLoaded} = useFavorites();
  const shopId = useMemo(() => String(params?.id ?? ''), [params]);

  const [shop, setShop] = useState<Shop | null>(null);
  const [shopLoading, setShopLoading] = useState(true);
  const [shopError, setShopError] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentWithImages[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [ratingSummary,setRatingSummary]=useState<{shopId:string;average:number|null;count:number}|null>(null);

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isAdminImageManagerOpen, setIsAdminImageManagerOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [shopSource, setShopSource] = useState<ShopSource | null>(null);

  const shopRequestRef = useRef(createRequestGuard());
  const commentsRequestRef = useRef(createRequestGuard());
  const authRequestRef = useRef(createRequestGuard());

  const galleryImages = useMemo(
    () => (shop?.imageUrls ?? []).filter((url) => typeof url === 'string' && url.trim().length > 0),
    [shop?.imageUrls]
  );

  const fetchShop = useCallback(async () => {
    setShopLoading(true);
    setShopError(null);
    setShopSource(null);

    const decision = await runLatest(shopRequestRef.current, () =>
      loadShopDetail(
        shopId,
        async (id) => {
          const {data, error} = await supabase
            .from('shops')
            .select('id,name,address,phone,image_urls,category,student_discount,tags,features,shop_type,rating_label,latitude,longitude,status,rating,review_count,total_sum,rating_count,review_text')
            .eq('id', id)
            .maybeSingle();

          return {
            shop: data ? mapSingleShop(data as Record<string, unknown>) : null,
            errorMessage: error?.message ?? null
          };
        },
        async (id) => {
          try {
            const response = await fetch(`/api/places/${id}`);
            const body = (await response.json().catch(() => null)) as {
              ok?: boolean;
              data?: Shop;
              error?: {code?: string; message?: string};
            } | null;

            return {
              ok: Boolean(response.ok && body?.ok),
              status: response.status,
              shop: body?.ok ? (body.data ?? null) : null,
              errorCode: body && !body.ok ? (body.error?.code ?? null) : null,
              errorMessage: body && !body.ok ? (body.error?.message ?? null) : null
            };
          } catch {
            return {ok: false, status: 0, shop: null, errorCode: null, errorMessage: '网络错误'};
          }
        }
      )
    );

    // A newer request (or a shopId navigation) replaced this one; discard it.
    if (decision === null) {
      return;
    }

    setShopLoading(false);

    if (decision.kind === 'use-shop') {
      setShop(decision.shop);
      setShopSource(decision.source);
      return;
    }

    setShop(null);

    if (decision.kind === 'not-found') {
      setShopError('店铺不存在或已被删除');
      return;
    }

    setShopError(decision.message);
  }, [shopId]);

  const fetchComments = useCallback(async () => {
    // Clear the previous place's comments and begin a new generation so a
    // stale reply for another place can never overwrite this one.
    const token = commentsRequestRef.current.begin();
    const isCurrent = () => commentsRequestRef.current.isCurrent(token);
    setComments([]);
    setCommentsLoading(true);
    setCommentsError(null);

    try {
      const result = await loadComments(shopId, async (id) => {
        const response = await fetch(`/api/places/${id}/reviews`,{cache:'no-store'});
        const body = (await response.json().catch(() => null)) as {
          ok?: boolean;
          data?: {items?: ReviewRow[];summary?:{average:number|null;count:number}};
          error?: {message?: string};
        } | null;

        if(isCurrent()&&response.ok&&body?.ok&&body.data?.summary) setRatingSummary({shopId, ...body.data.summary});
        return {
          ok: Boolean(response.ok && body?.ok),
          rows: body?.ok ? (body.data?.items ?? []) : [],
          errorMessage: body && !body.ok ? (body.error?.message ?? null) : null
        };
      });

      if (!isCurrent()) return;

      if (result.error) {
        setCommentsError(result.error);
        return;
      }

      setComments(
        result.items.map((item) => ({...item, comment_images: []}))
      );
    } catch {
      if (!isCurrent()) return;
      setComments([]);
      setCommentsError('评论加载失败，请稍后再试');
    } finally {
      // Only the freshest request may end the loading state.
      if (isCurrent()) {
        setCommentsLoading(false);
      }
    }
  }, [shopId]);

  const fetchAuthState = useCallback(async () => {
    const result = await loadAuthRole(
      authRequestRef.current,
      async () => {
        const {data, error} = await supabase.auth.getUser();
        if (error || !data?.user) return null;
        return data.user.id;
      },
      async (userId) => {
        const {data, error} = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();
        return {role: data?.role ?? null, error: error?.message ?? null};
      }
    );

    if (!result.isCurrent) return;
    if (result.signedOut) {
      setUserRole(null);
      setIsAdminImageManagerOpen(false);
      return;
    }
    setUserRole(result.role);
  }, []);

  useEffect(() => {
    // Guard objects are stable across renders; capture them so the cleanup
    // closes over the same instances React warns about otherwise.
    const shopGuard = shopRequestRef.current;
    const commentsGuard = commentsRequestRef.current;
    const authGuard = authRequestRef.current;

    void fetchShop();
    void fetchComments();
    void fetchAuthState();

    const {
      data: {subscription}
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUserRole(null);
        setIsAdminImageManagerOpen(false);
      }
      void fetchAuthState();
    });

    return () => {
      subscription.unsubscribe();
      // Invalidate in-flight requests when the shop changes or the page unmounts.
      shopGuard.invalidate();
      commentsGuard.invalidate();
      authGuard.invalidate();
    };
  }, [fetchShop, fetchComments, fetchAuthState]);

  const canManageImages = canManageLegacyImages(userRole, shopSource);

  useEffect(() => {
    setIsAdminImageManagerOpen(false);
  }, [shopId]);

  useEffect(() => {
    if (!canManageImages) {
      setIsAdminImageManagerOpen(false);
    }
  }, [canManageImages]);

  if (shopLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate-500">加载中...</div>;
  }

  if (shopError || !shop) {
    return <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-rose-600">{shopError ?? '加载失败'}</div>;
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm md:hidden">
        <div className="flex h-14 items-center justify-between px-3">
          <Link href={`/${locale}`} aria-label={t('back')} className="flex h-11 w-11 items-center justify-center rounded-full text-ink focus-visible:ring-2 focus-visible:ring-pine-700"><ArrowLeft size={22} aria-hidden="true" /></Link>
          <p className="text-sm font-semibold text-ink">{t('title')}</p>
          <button type="button" aria-label="收藏" aria-pressed={favorites.includes(shop.id)} disabled={!favoritesLoaded} onClick={() => toggleFavorite(shop.id)} className="flex h-11 w-11 items-center justify-center rounded-full text-pine-700 focus-visible:ring-2 focus-visible:ring-pine-700"><Heart size={21} aria-hidden="true" className={favorites.includes(shop.id) ? 'fill-current' : ''} /></button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-7 px-4 pb-40 pt-4 md:pb-12 md:pt-6">
        <ShopHero
          shop={ratingSummary?.shopId===shopId?{...shop,rating:ratingSummary.average??0,reviews:ratingSummary.count}:shop}
          onOpenLightbox={(index) => {
            setLightboxIndex(index);
            setIsLightboxOpen(true);
          }}
          onOpenAdminManager={() => setIsAdminImageManagerOpen(true)}
          canManageImages={canManageImages}
        />

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-ink">{t('reviews')}</h2><Link href={`/${locale}/shop/${shop.id}/review/new`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-pine-700"><MessageCirclePlus size={17} aria-hidden="true" />{t('writeReview')}</Link></div>
          <ReviewForm key={shopId} placeId={shopId} compact onSuccess={fetchComments} onRefresh={fetchComments}/>
          <CommentList comments={comments} loading={commentsLoading} error={commentsError} />
        </section>
      </main>

      <ImageLightbox
        images={galleryImages}
        currentIndex={lightboxIndex}
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        onChangeIndex={setLightboxIndex}
      />

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 md:hidden">
        <PlaceNavigationActions place={shop} variant="mobile-footer" />
      </div>

      {canManageImages && (
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
      )}
    </>
  );
}
