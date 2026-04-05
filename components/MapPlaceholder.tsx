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

function buildRestaurantPinHtml(): string {
  return `<div style="width:44px;height:52px;display:flex;align-items:flex-start;justify-content:center;">
    <svg width="44" height="52" viewBox="0 0 44 52" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <filter id="restaurantPinShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="rgba(15,122,67,.28)"/>
        </filter>
      </defs>
      <g filter="url(#restaurantPinShadow)">
        <path d="M22 50C22 50 7 36.5 7 24C7 14.6 14.6 7 24 7C33.4 7 41 14.6 41 24C41 36.5 22 50 22 50Z" fill="#ffffff"/>
        <circle cx="24" cy="24" r="12" fill="#0f7a43"/>
        <path d="M18.4 18.3V21.8C18.4 23 19.35 23.95 20.55 23.95V29.9" stroke="#facc15" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20.55 18.3V23.95" stroke="#facc15" stroke-width="1.9" stroke-linecap="round"/>
        <path d="M22.75 18.3V21.8" stroke="#facc15" stroke-width="1.9" stroke-linecap="round"/>
        <path d="M25.9 20.2C25.9 18.84 27.01 17.75 28.35 17.75V29.9" stroke="#facc15" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M25.9 20.2H28.35" stroke="#facc15" stroke-width="1.9" stroke-linecap="round"/>
      </g>
    </svg>
  </div>`;
}

function buildServicePinHtml(): string {
  return `<div style="width:40px;height:40px;border-radius:9999px;background:#ffffff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(15,122,67,.28);">
    <div style="width:30px;height:30px;border-radius:9999px;background:#0f7a43;display:flex;align-items:center;justify-content:center;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="3" stroke="#facc15" stroke-width="2"/>
        <path d="M8 8L16 16" stroke="#facc15" stroke-width="2" stroke-linecap="round"/>
        <path d="M16 8L8 16" stroke="#facc15" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
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
  const pinHtml = shop.type === '服务' ? buildServicePinHtml() : buildRestaurantPinHtml();
  const name = escapeHtml(shop.name);
  const topTags = shop.tags.slice(0, 3).map((tag) => `<span style="padding:2px 8px;border-radius:9999px;background:#f1f5f9;color:#334155;font-size:11px;font-weight:600;line-height:1.4;">${escapeHtml(tag)}</span>`).join('');

  return `<div style="position:relative;width:260px;height:52px;transform:translate(-50%,-100%);display:flex;justify-content:center;overflow:visible;pointer-events:none;">
    <div style="pointer-events:auto;">${pinHtml}</div>
    <div style="position:absolute;top:56px;left:50%;transform:translateX(-50%);width:220px;background:rgba(255,255,255,.96);border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 10px 24px rgba(2,30,18,.18);padding:10px 10px 9px;backdrop-filter:blur(2px);pointer-events:none;">
      <div style="font-size:14px;font-weight:700;line-height:1.35;color:#0f172a;word-break:break-word;">${name}</div>
      ${topTags ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">${topTags}</div>` : ''}
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
  const lastLocateSignalRef = useRef(0);
  const lastSelectedShopIdRef = useRef<Shop['id'] | null>(null);
  const contributionPickModeRef = useRef(contributionPickMode);
  const onPickCoordinatesRef = useRef(onPickCoordinates);

  const selectedShop = useMemo(
    () => shops.find((shop) => shop.id === selectedShopId && shop.hasCoordinates) ?? null,
    [shops, selectedShopId]
  );

  const buildMarkerHtml = (isActive: boolean, isHovered: boolean) => {
    const outer = isActive || isHovered ? 30 : 24;
    const inner = isActive || isHovered ? 14 : 12;
    const iconSize = isActive || isHovered ? 14 : 12;

    return `<div style="width:${outer}px;height:${outer}px;border-radius:9999px;background:#0f7a43;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.22);transform:translate(-50%,-100%);">
      <div style="width:${inner}px;height:${inner}px;border-radius:9999px;background:#fff;display:flex;align-items:center;justify-content:center;">
        <span style="font-size:${iconSize}px;line-height:1;color:#facc15;">🏠</span>
      </div>
    </div>`;
  };



  const flyToLocation = (longitude: number, latitude: number) => {
    const map = mapRef.current;
    if (!map) return;

    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

    map.setZoomAndCenter(isMobile ? 15.4 : 16, [longitude, latitude], true, {
      duration: isMobile ? 620 : 800
    });
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
        map.addControl(new AMap.ToolBar({position: {right: '16px', top: '16px'}}));

        map.on('click', (event) => {
          if (!contributionPickModeRef.current || !onPickCoordinatesRef.current) return;
          const lnglat = event.lnglat;
          onPickCoordinatesRef.current([lnglat.getLng(), lnglat.getLat()]);
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

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_10px_28px_rgba(2,30,18,0.08)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]">
      <div ref={containerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleLocateMe}
          className="pointer-events-auto rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow hover:bg-white"
        >
          {geoLoading ? '定位中...' : '定位到我'}
        </button>
      </div>
    </div>
  );
}
