'use client';

import Image from 'next/image';
import {useMemo, useState} from 'react';
import {Store} from 'lucide-react';
import {useTranslations} from 'next-intl';

interface MobileImageSliderProps {
  images: string[];
  onOpenLightbox?: (index: number) => void;
}

export default function MobileImageSlider({images, onOpenLightbox}: MobileImageSliderProps) {
  const t = useTranslations('ShopDetail');
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const validImages = useMemo(
    () => images.filter((url) => typeof url === 'string' && url.trim().length > 0),
    [images]
  );
  const [currentIndex, setCurrentIndex] = useState(0);

  if (validImages.length === 0 || validImages.every(url => failedImages.includes(url))) {
    return (
      <div className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl bg-[#eeefeb] text-[#8c9990]">
        <Store size={36} strokeWidth={1.3} aria-hidden="true" />
        <span className="text-xs">{t('noImage')}</span>
      </div>
    );
  }

  if (validImages.length === 1) {
    return (
      <button
        type="button"
        onClick={() => onOpenLightbox?.(0)}
        className="relative block h-60 w-full overflow-hidden rounded-xl border border-line"
      >
        <Image src={validImages[0]} alt="shop-mobile-image-1" fill onError={event => {const src = event.currentTarget.getAttribute("data-source"); if (src) setFailedImages(previous => [...previous, src]);}} data-source={validImages[0]} className="object-cover" sizes="100vw" />
      </button>
    );
  }

  const progressWidth = ((currentIndex + 1) / validImages.length) * 100;

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-line">
        <div
          className="flex h-60 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => {
            const index = Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth);
            setCurrentIndex(index);
          }}
        >
          {validImages.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={() => onOpenLightbox?.(index)}
              disabled={failedImages.includes(url)}
              className="relative min-w-full snap-center"
            >
              {failedImages.includes(url) ? <span className="flex h-full flex-col items-center justify-center gap-2 bg-[#eeefeb] text-muted"><Store size={36} strokeWidth={1.3} aria-hidden="true" /><span className="text-xs">{t('noImage')}</span></span> : <Image src={url} alt={`shop-mobile-image-${index + 1}`} fill onError={() => setFailedImages(previous => [...previous, url])} className="object-cover" sizes="100vw" />}
            </button>
          ))}
        </div>

        <div className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
          {currentIndex + 1} / {validImages.length}
        </div>
      </div>

      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-pine-700 transition-all duration-300"
          style={{width: `${progressWidth}%`}}
        />
      </div>
    </div>
  );
}
