'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Layer, Map, Marker, Popup, Source, type MapRef} from 'react-map-gl/mapbox';
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

const CLUSTER_SOURCE_ID = 'shops-clusters';

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

  const shopsGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: shops.map((shop) => ({
        type: 'Feature' as const,
        properties: {
          id: shop.id,
          name: shop.name
        },
        geometry: {
          type: 'Point' as const,
          coordinates: shop.coordinates
        }
      }))
    }),
    [shops]
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
        interactiveLayerIds={['clusters', 'unclustered-point']}
        onClick={(event) => {
          const map = mapRef.current?.getMap();
          if (!map) return;

          const clickedFeature = event.features?.[0];
          if (clickedFeature) {
            const layerId = clickedFeature.layer?.id;

            if (layerId === 'clusters') {
              const clusterId = clickedFeature.properties?.cluster_id;
              if (typeof clusterId === 'number') {
                const source = map.getSource(CLUSTER_SOURCE_ID) as mapboxgl.GeoJSONSource;
                source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                  if (err || typeof zoom !== 'number') return;
                  const coordinates = (clickedFeature.geometry as GeoJSON.Point).coordinates as [number, number];
                  map.easeTo({center: coordinates, zoom, duration: 500});
                });
              }
              return;
            }

            if (layerId === 'unclustered-point') {
              const clickedId = Number(clickedFeature.properties?.id);
              if (Number.isFinite(clickedId)) {
                const shop = shops.find((item) => item.id === clickedId);
                if (shop) {
                  onSelectShop(shop.id);
                  setPopupShop(shop);
                }
              }
              return;
            }
          }

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

        <Source
          id={CLUSTER_SOURCE_ID}
          type="geojson"
          data={shopsGeoJson}
          cluster
          clusterMaxZoom={15}
          clusterRadius={45}
        >
          <Layer
            id="clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': '#006633',
              'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 25, 28],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2
            }}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': ['get', 'point_count_abbreviated'],
              'text-size': 12
            }}
            paint={{
              'text-color': '#ffffff'
            }}
          />
          <Layer
            id="unclustered-point"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-color': '#FFD94A',
              'circle-radius': [
                'case',
                ['==', ['get', 'id'], selectedShopId ?? -1],
                10,
                ['==', ['get', 'id'], hoveredShopId ?? -1],
                10,
                7
              ],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2
            }}
          />
        </Source>

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
