import Image from 'next/image';
import Link from 'next/link';
import {Check, Navigation, Tag, Trash2} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import StarRating from '@/components/StarRating';
import {getRatingTagFromData} from '@/lib/utils/ratingTag';
import {Shop} from '@/types/shop';

interface ShopCardProps {
  shop: Shop;
  onLocate?: (shopId: Shop['id']) => void;
  canApprove?: boolean;
  approving?: boolean;
  onApprove?: (shopId: Shop['id']) => void;
  canDelete?: boolean;
  deleting?: boolean;
  onDelete?: (shopId: Shop['id']) => void;
}


function ShopPlaceholder() {
  return (
    <div className="flex h-40 w-full items-center justify-center bg-emerald-50">
      <svg
        viewBox="0 0 120 80"
        aria-hidden="true"
        className="h-16 w-24 text-[#0f7a43]"
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

export default function ShopCard({
  shop,
  onLocate,
  canApprove = false,
  approving = false,
  onApprove,
  canDelete = false,
  deleting = false,
  onDelete
}: ShopCardProps) {
  const t = useTranslations('ShopCard');
  const locale = useLocale();
  const isPending = shop.status === 'pending';
  const address = shop.address?.trim() || '地址信息收录中 (Address pending)';
  const isPendingAddress = address === '地址信息收录中 (Address pending)';
  const coverImageUrl = shop.imageUrls?.[0] ?? '';
  const hasValidImageUrl = typeof coverImageUrl === 'string' && coverImageUrl.trim().length > 0;
  const ratingTag = getRatingTagFromData(shop.rating, shop.tags, shop.subTags ?? []);

  return (
    <div className="group cursor-pointer rounded-2xl border border-slate-100/90 bg-white/95 p-4 shadow-md transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-0.5 hover:shadow-xl">
      <div className="mb-3 overflow-hidden rounded-xl border border-slate-100">
        {hasValidImageUrl ? (
          <Image src={coverImageUrl} alt={shop.name} width={640} height={360} className="h-40 w-full object-cover" />
        ) : (
          <ShopPlaceholder />
        )}
      </div>

      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-slate-800 transition-colors duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:text-[#006633]">
            {shop.name}
          </h3>
          <p className={`mt-1 text-sm ${isPendingAddress ? 'text-gray-400' : 'text-slate-500'} truncate`}>
            {address}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {shop.status === 'pending' && (
            <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              待核实
            </span>
          )}
          <div
            className={`rounded-md border px-2 py-1 text-xs font-semibold ${ratingTag.bgClass} ${ratingTag.textClass} ${ratingTag.borderClass}`}
          >
            {ratingTag.label}
          </div>
        </div>
      </div>

      {shop.studentDiscount && (
        <div className="flex items-center gap-1.5 text-sm text-indigo-600 font-medium mb-3 bg-indigo-50/50 w-fit px-2 py-1 rounded-md border border-indigo-100">
          <Tag className="w-4 h-4" />
          {shop.studentDiscount}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {shop.tags.map((tag) => (
          <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
            {tag}
          </span>
        ))}
      </div>

      <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('reviewTitle')}</p>
        <p className="text-sm text-slate-700 overflow-hidden [display:-webkit-box] [-webkit-line-clamp:3] [-webkit-box-orient:vertical]">
          {shop.reviewText?.trim() ? shop.reviewText : t('noDetailedReview')}
        </p>
      </div>

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-50">
        <StarRating score={shop.rating} reviewCount={shop.reviews} />

        <div className="flex items-center gap-3">
          {canApprove && isPending && (
            <button
              type="button"
              onClick={() => onApprove?.(shop.id)}
              disabled={approving}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-0.5 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              {approving ? t('approving') : t('approve')}
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete?.(shop.id)}
              disabled={deleting}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-0.5 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleting ? '删除中...' : '删除'}
            </button>
          )}

          <Link
            href={`/${locale}/shop/${shop.id}`}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            查看评论
          </Link>

          <button
            onClick={() => onLocate?.(shop.id)}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <Navigation className="w-3.5 h-3.5" />
            {t('viewLocation')}
          </button>
        </div>
      </div>
    </div>
  );
}
