'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Map, Marker, Popup, type MapRef} from 'react-map-gl/mapbox';
import {Store} from 'lucide-react';
import StarRating from '@/components/StarRating';
import {getRatingTagFromData} from '@/lib/utils/ratingTag';
import {Shop} from '@/types/shop';

interface MapPlaceholderProps {
  shops: Shop[];
  selectedShopId: Shop['id'] | null;
  hoveredShopId?: Shop['id'] | null;
  onSelectShop: (shopId: Shop['id']) => void;
  contributionPickMode?: boolean;
  onPickCoordinates?: (coords: [number, number]) => void;
  highlightedLocation?: {
    longitude: number;
    latitude: number;
    name?: string;
  } | null;
}

const MACAU_CENTER = {
  longitude: 113.5439,
  latitude: 22.1896,
  zoom: 14
} as const;

function mapLocaleToNameField(locale: string) {
  if (locale === 'zh-CN') return 'name_zh-Hans';
  if (['zh-MO', 'zh-HK', 'zh-TW'].includes(locale)) return 'name_zh-Hant';
  return 'name_en';
}

function applyMapLabelLanguage(map: mapboxgl.Map, locale: string) {
  const targetNameField = mapLocaleToNameField(locale);
  const style = map.getStyle();

  for (const layer of style.layers ?? []) {
    if (layer.type !== 'symbol') continue;

    const currentTextField = map.getLayoutProperty(layer.id, 'text-field');
    if (!currentTextField) continue;

    map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', targetNameField], ['get', 'name']]);
  }
}

export default function MapPlaceholder({
  shops,
  selectedShopId,
  hoveredShopId = null,
  onSelectShop,
  contributionPickMode = false,
  onPickCoordinates,
  highlightedLocation = null
}: MapPlaceholderProps) {
  const locale = useLocale();
  const t = useTranslations('Map');
  const mapRef = useRef<MapRef | null>(null);
  const [popupShop, setPopupShop] = useState<Shop | null>(null);

  const selectedShop = useMemo(
    () => shops.find((shop) => shop.id === selectedShopId) ?? null,
    [shops, selectedShopId]
  );

  useEffect(() => {
    if (!selectedShop || !mapRef.current) {
      return;
    }

    const [longitude, latitude] = selectedShop.coordinates;

    mapRef.current.flyTo({
      center: [longitude, latitude],
      zoom: 16,
      duration: 800,
      essential: true
    });

    setPopupShop(selectedShop);
  }, [selectedShop]);

  useEffect(() => {
    if (!highlightedLocation || !mapRef.current) {
      return;
    }

    mapRef.current.flyTo({
      center: [highlightedLocation.longitude, highlightedLocation.latitude],
      zoom: 16,
      duration: 800,
      essential: true
    });
  }, [highlightedLocation]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map?.isStyleLoaded()) return;

    applyMapLabelLanguage(map, locale);
  }, [locale]);

  const handleMapLoad = () => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    applyMapLabelLanguage(map, locale);
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_10px_28px_rgba(2,30,18,0.08)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]">
      <Map
        ref={mapRef}
        initialViewState={MACAU_CENTER}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
        style={{width: '100%', height: '100%'}}
        onLoad={handleMapLoad}
        onClick={(event) => {
          if (!contributionPickMode || !onPickCoordinates) return;
          const {lng, lat} = event.lngLat;
          onPickCoordinates([lng, lat]);
        }}
      >
        {highlightedLocation && (
          <Marker
            longitude={highlightedLocation.longitude}
            latitude={highlightedLocation.latitude}
            anchor="bottom"
          >
            <div className="h-4 w-4 rounded-full bg-red-500 border-2 border-white shadow" title={highlightedLocation.name ?? 'Search result'} />
          </Marker>
        )}

        {shops.map((shop) => {
          const [longitude, latitude] = shop.coordinates;
          const isSelected = selectedShopId === shop.id;
          const isHovered = hoveredShopId === shop.id;
          const isActive = isSelected || isHovered;

          return (
            <Marker
              key={shop.id}
              longitude={longitude}
              latitude={latitude}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelectShop(shop.id);
                setPopupShop(shop);
              }}
            >
              <button
                type="button"
                className={`group relative -translate-y-1 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                  isActive ? 'scale-110' : 'hover:scale-110'
                }`}
                aria-label={t('selectShop', {name: shop.name})}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-lg transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                    isActive ? 'border-[#FFCC00] bg-[#FFCC00] ring-4 ring-[#FFCC00]/35' : 'border-white bg-[#FFD94A]'
                  }`}
                >
                  <Store className={`h-4 w-4 ${isActive ? 'text-[#124d2f]' : 'text-[#1f5136]'}`} />
                </div>

                <div
                  className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg transition-opacity pointer-events-none ${
                    isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {t('shopPin', {name: shop.name})}
                </div>
              </button>
            </Marker>
          );
        })}

        {popupShop && (
          <Popup
            longitude={popupShop.coordinates[0]}
            latitude={popupShop.coordinates[1]}
            anchor="top"
            closeOnClick={false}
            onClose={() => setPopupShop(null)}
            offset={18}
          >
            <div className="min-w-52 max-w-64 rounded-xl p-1 text-slate-800">
              <h3 className="text-base font-bold leading-tight">{popupShop.name}</h3>

              <div className="mt-2 flex items-center gap-2">
                {(() => {
                  const popupRatingTag = getRatingTagFromData(popupShop.rating, popupShop.tags, popupShop.subTags ?? []);

                  return (
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${popupRatingTag.bgClass} ${popupRatingTag.textClass}`}
                    >
                      {popupRatingTag.label}
                    </span>
                  );
                })()}
              </div>

              <div className="mt-2">
                <StarRating score={popupShop.rating} reviewCount={popupShop.reviews} />
              </div>

              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('tagsLabel')}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {popupShop.tags.length > 0 ? (
                    popupShop.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">{t('noTags')}</span>
                  )}
                </div>
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
