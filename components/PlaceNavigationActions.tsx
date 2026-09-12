'use client';

import {Copy, ExternalLink, Navigation} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useState} from 'react';
import {buildAmapNavigationUrl} from '@/lib/amap/navigation';
import type {Shop} from '@/types/shop';

type PlaceNavigationActionsProps = {
  place: Pick<Shop, 'name' | 'address' | 'coordinates' | 'hasCoordinates'>;
};

export default function PlaceNavigationActions({place}: PlaceNavigationActionsProps) {
  const t = useTranslations('PlaceNavigation');
  const [copyResult, setCopyResult] = useState<{text: string; success: boolean} | null>(null);
  const navigationUrl = buildAmapNavigationUrl(place);
  const webUrl = buildAmapNavigationUrl(place, {callNative: false});
  const address = place.address.trim();
  const copyText = address ? `${place.name.trim()}\n${address}` : '';
  const currentCopyResult = copyResult?.text === copyText ? copyResult : null;
  const actionClassName = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2';

  const copyAddress = async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopyResult({text: copyText, success: true});
    } catch {
      // Clipboard access can be unavailable or denied in embedded browsers.
      setCopyResult({text: copyText, success: false});
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {navigationUrl ? (
          <a
            href={navigationUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('navigateTo', {name: place.name})}
            className={`${actionClassName} bg-[#006633] text-white hover:bg-emerald-800`}
          >
            <Navigation aria-hidden="true" className="h-4 w-4" />
            {t('navigate')}
          </a>
        ) : (
          <button type="button" disabled className={`${actionClassName} cursor-not-allowed bg-slate-100 text-slate-500`}>
            <Navigation aria-hidden="true" className="h-4 w-4" />
            {t('navigate')}
          </button>
        )}
        <button
          type="button"
          onClick={() => void copyAddress()}
          disabled={!copyText}
          className={`${actionClassName} border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400`}
        >
          <Copy aria-hidden="true" className="h-4 w-4" />
          {t('copyAddress')}
        </button>
      </div>

      {!navigationUrl && <p className="text-xs text-slate-500">{t('missingCoordinates')}</p>}
      {!copyText && <p className="text-xs text-slate-500">{t('missingAddress')}</p>}

      <p role="status" className="text-xs text-emerald-800">
        {currentCopyResult ? t(currentCopyResult.success ? 'copied' : 'copyFailed') : ''}
      </p>
      {currentCopyResult?.success === false && (
        <textarea
          readOnly
          rows={2}
          value={copyText}
          aria-label={t('addressToCopy')}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        />
      )}

      {webUrl && (
        <details className="text-xs text-slate-600">
          <summary className="w-fit cursor-pointer rounded py-1 underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            {t('help')}
          </summary>
          <div className="mt-1 space-y-1 rounded-lg bg-slate-50 p-2">
            <a href={webUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 font-medium text-emerald-800 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              {t('webRoute')}
            </a>
            <p>{t('helpText')}</p>
          </div>
        </details>
      )}
    </div>
  );
}
