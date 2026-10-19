'use client';

import Image from 'next/image';
import {Store} from 'lucide-react';
import {useState} from 'react';

/** Keep a failed remote image from exposing a broken-image icon in a card. */
export default function PlaceCover({src, name, size = 80}: {src?: string; name: string; size?: number}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!src?.trim() || failedSource === src) {
    return <div className="flex h-full w-full items-center justify-center bg-[#eeefeb] text-[#8c9990]"><Store aria-hidden="true" size={Math.round(size * 0.4)} strokeWidth={1.4} /></div>;
  }
  return <Image src={src} alt={name} width={size} height={size} sizes={`${size}px`} className="h-full w-full object-cover" onError={() => setFailedSource(src)} />;
}
