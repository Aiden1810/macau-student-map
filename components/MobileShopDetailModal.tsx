'use client';

import Image from 'next/image';
import {MessageCircle, Navigation, Star, StarHalf, X} from 'lucide-react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import MobileImageSlider from '@/components/MobileImageSlider';
import ImageLightbox from '@/components/ImageLightbox';
import ReviewForm from '@/components/reviews/ReviewForm';
import {Shop} from '@/types/shop';

type CommentWithImages = {
  id: string;
  shopId: string;
  content: string;
  rating: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
  comment_images: Array<{image_url: string}>;
};

function InlineStarRating({score, reviewCount}: {score: number; reviewCount?: number}) {
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.min(5, score)) : 0;
  const fullStars = Math.floor(safeScore);
  const hasHalfStar = safeScore - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  if (safeScore <= 0) {
    return <span className="text-xs text-slate-400">暂无评分</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({length: fullStars}).map((_, i) => (
          <Star key={`f-${i}`} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        ))}
        {hasHalfStar && <StarHalf className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
        {Array.from({length: emptyStars}).map((_, i) => (
          <Star key={`e-${i}`} className="h-3.5 w-3.5 text-slate-300" />
        ))}
      </div>
      <span className="text-sm font-bold text-slate-700">{safeScore.toFixed(1)}</span>
      {typeof reviewCount === 'number' && (
        <span className="text-xs text-slate-400">({reviewCount} 条评论)</span>
      )}
    </div>
  );
}


interface MobileShopDetailModalProps {
  shop: Shop;
  open: boolean;
  onClose: () => void;
  onLocate: (shopId: Shop['id']) => void;
}

export default function MobileShopDetailModal({shop, open, onClose, onLocate}: MobileShopDetailModalProps) {
  const [comments, setComments] = useState<CommentWithImages[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);

  // Lightbox
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const galleryImages = useMemo(
    () => (shop.imageUrls ?? []).filter((url) => typeof url === 'string' && url.trim().length > 0),
    [shop.imageUrls]
  );

  const fetchComments = useCallback(async () => {
    setCommentsLoading(true);
    const response = await fetch(`/api/places/${shop.id}/reviews`);
    const result = (await response.json().catch(() => null)) as {
      ok?: boolean;
      data?: {items?: Array<{id: string; placeId: string; content: string | null; rating: number; createdAt: string}>};
    } | null;
    setCommentsLoading(false);

    if (!response.ok || !result?.ok) {
      setComments([]);
      return;
    }

    const normalized = (result.data?.items ?? []).map((row) => ({
      id: String(row.id),
      shopId: String(row.placeId),
      content: String(row.content ?? ''),
      rating: Number(row.rating ?? 0) as 1 | 2 | 3 | 4 | 5,
      createdAt: String(row.createdAt),
      comment_images: []
    }));

    setComments(normalized);
  }, [shop.id]);

  useEffect(() => {
    if (open) {
      fetchComments();
    }
  }, [open, fetchComments]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
          <h2 className="text-lg font-bold text-slate-900 truncate pr-2">{shop.name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {/* Image Slider */}
          {galleryImages.length > 0 && (
            <div className="px-4 pt-3">
              <MobileImageSlider
                images={galleryImages}
                onOpenLightbox={(index) => {
                  setLightboxIndex(index);
                  setIsLightboxOpen(true);
                }}
              />
            </div>
          )}

          {/* Shop Info */}
          <div className="px-4 pt-3">
            <h3 className="text-xl font-bold text-slate-900">{shop.name}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {shop.address?.trim() || '地址信息收录中 (Address pending)'}
            </p>

            <div className="mt-2 flex items-center gap-3">
              <InlineStarRating score={shop.rating} reviewCount={shop.reviews} />
              <span className="text-sm font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                人均 {shop.pricePerPerson ? `MOP ${shop.pricePerPerson}` : '暂无'}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap content-start items-start gap-2 pb-2">
              {shop.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex shrink-0 items-center rounded-md bg-slate-100 px-2 py-1.5 text-[13px] leading-normal text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onLocate(shop.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#006633]/20 bg-[#006633]/5 px-3 py-2 text-sm font-semibold text-[#006633] transition hover:bg-[#006633]/10"
              >
                <Navigation className="h-4 w-4" />
                查看位置
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-4 mt-4 border-t border-slate-100" />

          {/* Post Comment Section */}
          <div className="px-4 pt-4">
            <ReviewForm placeId={shop.id} compact onSuccess={fetchComments} />
          </div>

          {/* Divider */}
          <div className="mx-4 mt-4 border-t border-slate-100" />

          {/* Comments List */}
          <div className="px-4 pt-4">
            <h3 className="text-base font-semibold text-slate-900 mb-3">
              <MessageCircle className="inline h-4 w-4 mr-1 -mt-0.5" />
              评论 ({comments.length})
            </h3>

            {commentsLoading ? (
              <p className="text-sm text-slate-500">加载中...</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-slate-500">还没有评论，来抢沙发吧。</p>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => {
                  const dateLabel = new Date(comment.createdAt).toLocaleString();
                  const cScore = Number.isFinite(comment.rating) ? Math.max(0, Math.min(5, comment.rating)) : 0;
                  const cFull = Math.floor(cScore);
                  const cHalf = cScore - cFull >= 0.5;
                  const cEmpty = 5 - cFull - (cHalf ? 1 : 0);

                  return (
                    <article key={comment.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-0.5">
                          {Array.from({length: cFull}).map((_, i) => (
                            <Star key={`cf-${i}`} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          ))}
                          {cHalf && <StarHalf className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                          {Array.from({length: cEmpty}).map((_, i) => (
                            <Star key={`ce-${i}`} className="h-3.5 w-3.5 text-slate-300" />
                          ))}
                        </div>
                        <span className="text-[11px] text-slate-400">{dateLabel}</span>
                      </div>

                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{comment.content?.trim() ? comment.content : '用户仅打分，未填写文字评论。'}</p>

                      {comment.comment_images.length > 0 && (
                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          {comment.comment_images.map((img, idx) => (
                            <div key={`${comment.id}-img-${idx}`} className="overflow-hidden rounded-lg border border-slate-100">
                              <Image
                                src={img.image_url}
                                alt={`comment-${comment.id}-img-${idx + 1}`}
                                width={200}
                                height={200}
                                className="h-20 w-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <ImageLightbox
        images={galleryImages}
        currentIndex={lightboxIndex}
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        onChangeIndex={setLightboxIndex}
      />
    </>
  );
}
