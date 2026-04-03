'use client';

import Image from 'next/image';
import {ChevronLeft, ChevronRight, X} from 'lucide-react';
import {useCallback, useEffect} from 'react';

interface ImageLightboxProps {
  images: string[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onChangeIndex: (nextIndex: number) => void;
}

export default function ImageLightbox({
  images,
  currentIndex,
  isOpen,
  onClose,
  onChangeIndex
}: ImageLightboxProps) {
  const total = images.length;

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    onChangeIndex((currentIndex - 1 + total) % total);
  }, [currentIndex, onChangeIndex, total]);

  const goNext = useCallback(() => {
    if (total <= 1) return;
    onChangeIndex((currentIndex + 1) % total);
  }, [currentIndex, onChangeIndex, total]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'ArrowLeft') {
        goPrev();
        return;
      }

      if (event.key === 'ArrowRight') {
        goNext();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev, isOpen, onClose]);

  if (!isOpen || total === 0) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="图片查看器"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25"
        aria-label="关闭"
      >
        <X className="h-5 w-5" />
      </button>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goPrev();
            }}
            className="absolute left-4 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25"
            aria-label="上一张"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25"
            aria-label="下一张"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <div className="relative h-[80vh] w-full max-w-6xl" onClick={(event) => event.stopPropagation()}>
        <Image
          src={images[currentIndex]}
          alt={`shop-image-${currentIndex + 1}`}
          fill
          className="object-contain"
          sizes="100vw"
          priority
        />
      </div>
    </div>
  );
}
