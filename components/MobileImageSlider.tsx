'use client';

import Image from 'next/image';
import {useMemo, useState} from 'react';

interface MobileImageSliderProps {
  images: string[];
  onOpenLightbox?: (index: number) => void;
}

export default function MobileImageSlider({images, onOpenLightbox}: MobileImageSliderProps) {
  const validImages = useMemo(
    () => images.filter((url) => typeof url === 'string' && url.trim().length > 0),
    [images]
  );
  const [currentIndex, setCurrentIndex] = useState(0);

  if (validImages.length === 0) {
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

  if (validImages.length === 1) {
    return (
      <button
        type="button"
        onClick={() => onOpenLightbox?.(0)}
        className="relative block h-80 w-full overflow-hidden rounded-xl border border-slate-100"
      >
        <Image src={validImages[0]} alt="shop-mobile-image-1" fill className="object-cover" sizes="100vw" />
      </button>
    );
  }

  const progressWidth = ((currentIndex + 1) / validImages.length) * 100;

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-slate-100">
        <div
          className="flex h-80 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              className="relative min-w-full snap-center"
            >
              <Image src={url} alt={`shop-mobile-image-${index + 1}`} fill className="object-cover" sizes="100vw" />
            </button>
          ))}
        </div>

        <div className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
          {currentIndex + 1} / {validImages.length}
        </div>
      </div>

      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-indigo-600 transition-all duration-300"
          style={{width: `${progressWidth}%`}}
        />
      </div>
    </div>
  );
}
