'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {Shop} from '@/types/shop';

interface MapPlaceholderProps {
  shops: Shop[];
  selectedShopId: Shop['id'] | null;
  locateSignal?: number;
  onSelectShop: (shopId: Shop['id']) => void;
  contributionPickMode?: boolean;
  onPickCoordinates?: (coords: [number, number]) => void;
  highlightedLocation?: {
    longitude: number;
    latitude: number;
    name?: string;
  } | null;
}

type AMapLngLat = {
  getLng: () => number;
  getLat: () => number;
};

type AMapMarker = {
  on: (event: string, handler: () => void) => void;
  setMap: (map: AMapMapInstance | null) => void;
  setContent?: (content: HTMLElement | string) => void;
};

type AMapMapInstance = {
  addControl: (control: unknown) => void;
  on: (event: string, handler: (event: {lnglat: AMapLngLat}) => void) => void;
  destroy: () => void;
  setZoomAndCenter: (zoom: number, center: [number, number], immediately?: boolean, options?: {duration?: number}) => void;
  setFitView?: (overlays?: unknown[], immediately?: boolean, avoid?: number[], maxZoom?: number) => void;
  getZoom?: () => number;
  getCenter?: () => {getLng: () => number; getLat: () => number};
  setZoom?: (zoom: number, immediately?: boolean, options?: {duration?: number}) => void;
};

type AMapGeolocation = {
  getCurrentPosition: (
    callback: (status: string, result: {position?: {lng?: number; lat?: number}}) => void
  ) => void;
};

type AMapNamespace = {
  Map: new (
    container: HTMLElement,
    options: {center: [number, number]; zoom: number; mapStyle: string; viewMode: '2D' | '3D'}
  ) => AMapMapInstance;
  Scale: new () => unknown;
  ToolBar: new (options: {position: {right: string; top: string}}) => unknown;
  Marker: new (options: {
    position: [number, number];
    offset?: unknown;
    content?: string;
    zIndex?: number;
    extData?: {shopId: string};
  }) => AMapMarker;
  Pixel: new (x: number, y: number) => unknown;
  MarkerCluster: new (
    map: AMapMapInstance,
    markers: AMapMarker[],
    options: {gridSize: number; renderClusterMarker: (context: {count: number; marker: {setContent: (content: HTMLElement) => void}}) => void}
  ) => {setMap: (map: AMapMapInstance | null) => void};
  Geolocation: new (options: {
    enableHighAccuracy: boolean;
    timeout: number;
    showMarker: boolean;
    showCircle: boolean;
    zoomToAccuracy: boolean;
  }) => AMapGeolocation;
  plugin: (name: string, callback: () => void) => void;
};

type AMapWindow = Window & {
  AMap?: AMapNamespace;
  __amapLoadingPromise?: Promise<AMapNamespace>;
  _AMapSecurityConfig?: {securityJsCode?: string};
};

type MarkerStore = {
  marker: AMapMarker;
};

const MACAU_CENTER: [number, number] = [113.5439, 22.1896];

function getAMapFromWindow(): AMapNamespace | undefined {
  return (window as AMapWindow).AMap;
}

function loadAmapScript(key: string): Promise<AMapNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('AMap only works in browser'));
  }

  const w = window as AMapWindow;
  const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE;

  if (securityCode && !w._AMapSecurityConfig) {
    w._AMapSecurityConfig = {securityJsCode: securityCode};
  }

  if (w.AMap) {
    return Promise.resolve(w.AMap);
  }

  if (w.__amapLoadingPromise) {
    return w.__amapLoadingPromise;
  }

  w.__amapLoadingPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-amap="true"]');

    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (w.AMap) resolve(w.AMap);
      });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load AMap script')));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.Scale,AMap.ToolBar,AMap.Geolocation,AMap.MarkerCluster`;
    script.async = true;
    script.defer = true;
    script.dataset.amap = 'true';

    script.onload = () => {
      if (w.AMap) {
        resolve(w.AMap);
      } else {
        reject(new Error('AMap script loaded but AMap is unavailable'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load AMap script'));

    document.head.appendChild(script);
  });

  return w.__amapLoadingPromise;
}

function buildShopPinHtml(size: 'default' | 'selected' = 'default', anchored = true): string {
  const width = size === 'selected' ? 44 : 36;
  const height = size === 'selected' ? 54 : 46;
  const iconScale = size === 'selected' ? 1 : 0.9;
  const anchorTransform = anchored ? 'transform:translate(-50%,-100%);' : '';

  return `<div style="width:${width}px;height:${height}px;${anchorTransform}display:flex;align-items:flex-start;justify-content:center;">
    <svg width="${width}" height="${height}" viewBox="0 0 44 54" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <filter id="shopPinShadow" x="-60%" y="-50%" width="220%" height="220%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.4" flood-color="rgba(22,101,52,0.28)"/>
        </filter>
      </defs>
      <g filter="url(#shopPinShadow)">
        <path d="M22 52C22 52 7 38.2 7 24.6C7 15.3 13.7 8 22 8C30.3 8 37 15.3 37 24.6C37 38.2 22 52 22 52Z" fill="#ffffff"/>
        <circle cx="22" cy="24" r="11.4" fill="#166534"/>
        <g transform="translate(${22 - 6.5 * iconScale} ${24 - 6.5 * iconScale}) scale(${iconScale})" stroke="#f59e0b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none">
          <path d="M2.4 1.5V5.2C2.4 6.3 3.25 7.15 4.35 7.15V12.5"/>
          <path d="M4.35 1.5V7.15"/>
          <path d="M6.3 1.5V5.2"/>
          <path d="M8.95 3.2C8.95 1.95 9.95 0.95 11.2 0.95V12.5"/>
          <path d="M8.95 3.2H11.2"/>
        </g>
      </g>
    </svg>
  </div>`;
}

function escapeHtml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildSelectedShopMarkerHtml(shop: Shop): string {
  const pinHtml = buildShopPinHtml('selected', false);
  const name = escapeHtml(shop.name);
  const ratingLabel = escapeHtml(shop.ratingLabel);
  const roundedRating = Math.max(0, Math.min(5, Number.isFinite(shop.rating) ? shop.rating : 0));
  const score = roundedRating.toFixed(1);
  const reviewText = escapeHtml(`(${shop.reviews} 条评论)`);
  const fullStars = Math.floor(roundedRating);
  const hasHalfStar = roundedRating - fullStars >= 0.5;
  const emptyStars = Math.max(0, 5 - fullStars - (hasHalfStar ? 1 : 0));
  const fullStarHtml = '<span style="color:#f59e0b;">★</span>'.repeat(fullStars);
  const halfStarHtml = hasHalfStar ? '<span style="color:#f59e0b;opacity:.55;">★</span>' : '';
  const emptyStarHtml = '<span style="color:#cbd5e1;">☆</span>'.repeat(emptyStars);
  const starsHtml = `${fullStarHtml}${halfStarHtml}${emptyStarHtml}`;
  const primaryTag = escapeHtml(shop.tags[0] ?? '暂无标签');

  return `<div style="position:relative;width:248px;height:54px;transform:translate(-50%,-100%);display:flex;justify-content:center;overflow:visible;pointer-events:none;">
    <div>${pinHtml}</div>
    <div style="position:absolute;bottom:58px;left:50%;transform:translateX(-50%);width:228px;background:#ffffff;border:1px solid rgba(22,101,52,0.18);border-radius:12px;box-shadow:0 10px 22px rgba(15,23,42,0.12);padding:10px 11px;pointer-events:none;">
      <div style="font-size:14px;font-weight:700;line-height:1.3;color:#166534;word-break:break-word;">${name}</div>
      <div style="margin-top:5px;display:inline-flex;align-items:center;border-radius:9999px;background:rgba(245,158,11,0.14);color:#f59e0b;font-size:11px;font-weight:700;line-height:1;padding:4px 8px;">${ratingLabel}</div>
      <div style="margin-top:7px;display:flex;align-items:center;gap:6px;font-size:12px;line-height:1.2;">
        <span style="color:#f59e0b;letter-spacing:0.5px;">${starsHtml}</span>
        <span style="color:#111827;font-weight:600;">${score}</span>
        <span style="color:#6b7280;">${reviewText}</span>
      </div>
      <div style="margin-top:7px;display:inline-flex;align-items:center;border-radius:9999px;background:#f8fafc;border:1px solid #e2e8f0;color:#334155;font-size:11px;font-weight:600;line-height:1;padding:4px 8px;">${primaryTag}</div>
    </div>
  </div>`;
}

export default function MapPlaceholder({
  shops,
  selectedShopId,
  locateSignal = 0,
  onSelectShop,
  contributionPickMode = false,
  onPickCoordinates,
  highlightedLocation = null
}: MapPlaceholderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<AMapMapInstance | null>(null);
  const markersRef = useRef<Map<string, MarkerStore>>(new Map());
  const clusterRef = useRef<{setMap: (map: AMapMapInstance | null) => void} | null>(null);
  const selectedPinRef = useRef<AMapMarker | null>(null);
  const selectedShopPinRef = useRef<AMapMarker | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [mapViewport, setMapViewport] = useState<{zoom: number; center: [number, number] | null}>({zoom: 14, center: null});
  const lastLocateSignalRef = useRef(0);
  const lastSelectedShopIdRef = useRef<Shop['id'] | null>(null);
  const contributionPickModeRef = useRef(contributionPickMode);
  const onPickCoordinatesRef = useRef(onPickCoordinates);

  const selectedShop = useMemo(
    () => shops.find((shop) => shop.id === selectedShopId && shop.hasCoordinates) ?? null,
    [shops, selectedShopId]
  );

  const buildMarkerHtml = (isActive: boolean, isHovered: boolean) => {
    if (isActive || isHovered) {
      return buildShopPinHtml('selected');
    }

    return buildShopPinHtml('default');
  };



  const flyToLocation = (longitude: number, latitude: number) => {
    const map = mapRef.current;
    if (!map) return;

    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

    map.setZoomAndCenter(isMobile ? 15.4 : 16, [longitude, latitude], true, {
      duration: isMobile ? 620 : 800
    });
    setMapViewport({zoom: isMobile ? 15.4 : 16, center: [longitude, latitude]});
  };

  useEffect(() => {
    contributionPickModeRef.current = contributionPickMode;
  }, [contributionPickMode]);

  useEffect(() => {
    onPickCoordinatesRef.current = onPickCoordinates;
  }, [onPickCoordinates]);

  useEffect(() => {
    const amapKey = process.env.NEXT_PUBLIC_AMAP_WEB_KEY;

    if (!containerRef.current || !amapKey) {
      return;
    }

    if (typeof window !== 'undefined') {
      const w = window as AMapWindow;
      const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE;
      if (securityCode && !w._AMapSecurityConfig) {
        w._AMapSecurityConfig = {securityJsCode: securityCode};
      }
    }

    let cancelled = false;
    const markers = markersRef.current;

    const initMap = async () => {
      try {
        const AMap = await loadAmapScript(amapKey);
        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = new AMap.Map(containerRef.current, {
          center: MACAU_CENTER,
          zoom: 14,
          mapStyle: 'amap://styles/normal',
          viewMode: '2D'
        });

        map.addControl(new AMap.Scale());

        map.on('click', (event) => {
          if (!contributionPickModeRef.current || !onPickCoordinatesRef.current) return;
          const lnglat = event.lnglat;
          onPickCoordinatesRef.current([lnglat.getLng(), lnglat.getLat()]);
        });

        map.on('moveend', () => {
          const currentZoom = map.getZoom?.() ?? 14;
          const currentCenter = map.getCenter?.();
          setMapViewport({
            zoom: currentZoom,
            center: currentCenter ? [currentCenter.getLng(), currentCenter.getLat()] : null
          });
        });

        mapRef.current = map;
        setMapReady(true);
      } catch {
        setMapReady(false);
      }
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      markers.clear();
      clusterRef.current = null;
      selectedPinRef.current = null;
      selectedShopPinRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    const AMap = getAMapFromWindow();
    if (!AMap) return;

    if (clusterRef.current) {
      clusterRef.current.setMap(null);
      clusterRef.current = null;
    }

    for (const item of markersRef.current.values()) {
      item.marker.setMap(null);
    }
    markersRef.current.clear();

    const validShops = shops.filter((shop) => shop.hasCoordinates);

    const markers = validShops.map((shop) => {
      const marker = new AMap.Marker({
        position: shop.coordinates,
        offset: new AMap.Pixel(0, 0),
        content: buildMarkerHtml(false, false),
        extData: {shopId: shop.id}
      });

      marker.on('click', () => {
        onSelectShop(shop.id);
      });

      markersRef.current.set(shop.id, {marker});
      return marker;
    });

    if (markers.length === 0) return;

    clusterRef.current = new AMap.MarkerCluster(map, markers, {
      gridSize: 60,
      renderClusterMarker: (context) => {
        const count = context.count;
        const div = document.createElement('div');
        div.style.width = '36px';
        div.style.height = '36px';
        div.style.borderRadius = '9999px';
        div.style.background = '#006633';
        div.style.border = '2px solid #fff';
        div.style.color = '#fff';
        div.style.fontSize = '12px';
        div.style.fontWeight = '700';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'center';
        div.style.boxShadow = '0 2px 10px rgba(0,0,0,.25)';
        div.textContent = String(count);
        context.marker.setContent(div);
      }
    });
  }, [shops, mapReady, onSelectShop]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = getAMapFromWindow();

    if (!map || !AMap) {
      return;
    }

    const shouldRefocus = locateSignal !== lastLocateSignalRef.current;
    lastLocateSignalRef.current = locateSignal;

    const selectionChanged = selectedShop?.id !== lastSelectedShopIdRef.current;
    lastSelectedShopIdRef.current = selectedShop?.id ?? null;

    if (!selectedShop) {
      if (selectedShopPinRef.current) {
        selectedShopPinRef.current.setMap(null);
        selectedShopPinRef.current = null;
      }
      return;
    }

    if (selectedShopPinRef.current) {
      selectedShopPinRef.current.setMap(null);
      selectedShopPinRef.current = null;
    }

    const marker = new AMap.Marker({
      position: selectedShop.coordinates,
      offset: new AMap.Pixel(0, 0),
      zIndex: 320,
      content: buildSelectedShopMarkerHtml(selectedShop)
    });

    marker.setMap(map);
    selectedShopPinRef.current = marker;

    if (shouldRefocus || selectionChanged) {
      flyToLocation(selectedShop.coordinates[0], selectedShop.coordinates[1]);
    }
  }, [selectedShop, locateSignal]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = getAMapFromWindow();

    if (!map || !AMap || !highlightedLocation) return;

    if (selectedPinRef.current) {
      selectedPinRef.current.setMap(null);
      selectedPinRef.current = null;
    }

    const marker = new AMap.Marker({
      position: [highlightedLocation.longitude, highlightedLocation.latitude],
      content:
        '<div style="width:16px;height:16px;border-radius:9999px;background:#ef4444;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.2);transform:translate(-50%,-100%);"></div>'
    });

    marker.setMap(map);
    selectedPinRef.current = marker;

    flyToLocation(highlightedLocation.longitude, highlightedLocation.latitude);
  }, [highlightedLocation]);

  const handleLocateMe = () => {
    const map = mapRef.current;
    const AMap = getAMapFromWindow();
    if (!map || !AMap || geoLoading) return;

    setGeoLoading(true);

    AMap.plugin('AMap.Geolocation', () => {
      const geolocation = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 10000,
        showMarker: true,
        showCircle: true,
        zoomToAccuracy: true
      });

      geolocation.getCurrentPosition((status, result) => {
        setGeoLoading(false);

        if (status !== 'complete') {
          return;
        }

        const lng = result.position?.lng;
        const lat = result.position?.lat;
        if (typeof lng === 'number' && typeof lat === 'number') {
          flyToLocation(lng, lat);
        }
      });
    });
  };

  const handleZoomIn = () => {
    const map = mapRef.current;
    if (!map?.setZoom) return;
    const currentZoom = map.getZoom?.() ?? mapViewport.zoom;
    map.setZoom(Math.min(currentZoom + 1, 20), true, {duration: 220});
  };

  const handleZoomOut = () => {
    const map = mapRef.current;
    if (!map?.setZoom) return;
    const currentZoom = map.getZoom?.() ?? mapViewport.zoom;
    map.setZoom(Math.max(currentZoom - 1, 3), true, {duration: 220});
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-none border-0 bg-transparent shadow-none md:rounded-2xl md:border md:border-slate-200/90 md:bg-white md:shadow-[0_10px_28px_rgba(2,30,18,0.08)] md:transition-all md:duration-300 md:ease-[cubic-bezier(0.4,0,0.2,1)]">
      <div ref={containerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute right-3 top-28 z-20 flex flex-col gap-[2px] md:hidden">
        <button
          type="button"
          onClick={handleZoomIn}
          className="pointer-events-auto h-9 w-9 rounded-t-[11px] rounded-b-[5px] text-sm font-bold text-[#1a1a1a]/80"
          style={{
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(24px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
            border: '0.5px solid rgba(255,255,255,0.7)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)'
          }}
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="pointer-events-auto h-9 w-9 rounded-t-[5px] rounded-b-[11px] text-sm font-bold text-[#1a1a1a]/80"
          style={{
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(24px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
            border: '0.5px solid rgba(255,255,255,0.7)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)'
          }}
        >
          −
        </button>

        <button
          type="button"
          onClick={handleLocateMe}
          className="pointer-events-auto mt-1.5 flex h-9 w-9 items-center justify-center rounded-full"
          style={{
            background: geoLoading ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(24px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
            border: '0.5px solid rgba(255,255,255,0.7)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)'
          }}
        >
          {geoLoading ? (
            <svg className="h-4 w-4 animate-spin text-[#1a1a1a]/70" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg className="h-4 w-4 text-[#1a1a1a]/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <circle cx="12" cy="12" r="8" strokeOpacity="0.4"/>
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
