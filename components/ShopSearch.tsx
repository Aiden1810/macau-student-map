import {useState} from 'react';
import gcoord from 'gcoord';

const AMAP_WEB_KEY = process.env.NEXT_PUBLIC_AMAP_WEB_KEY ?? '';

export type SearchShopResult = {
  id: string;
  name: string;
  address: string;
  category: string;
  mapboxLng: number;
  mapboxLat: number;
  amapLng: number;
  amapLat: number;
};

type ShopSearchProps = {
  onShopSelect?: (shop: SearchShopResult) => void;
};

type AmapPoi = {
  id?: string;
  name?: string;
  address?: string;
  type?: string;
  location?: string;
};

type AmapResponse = {
  status?: string;
  pois?: AmapPoi[];
};

export default function ShopSearch({onShopSelect}: ShopSearchProps) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchShopResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!keyword.trim() || !AMAP_WEB_KEY) {
      if (!AMAP_WEB_KEY) {
        setError('Missing NEXT_PUBLIC_AMAP_WEB_KEY');
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(keyword)}&offset=10&page=1&key=${AMAP_WEB_KEY}&extensions=all`,
      );
      const data = (await response.json()) as AmapResponse;

      if (data.status === '1' && Array.isArray(data.pois)) {
        const processedResults: SearchShopResult[] = data.pois
          .map((poi) => {
            if (!poi.location || !poi.id || !poi.name) return null;

            const [lngStr, latStr] = poi.location.split(',');
            const amapLng = Number(lngStr);
            const amapLat = Number(latStr);

            if (!Number.isFinite(amapLng) || !Number.isFinite(amapLat)) {
              return null;
            }

            const [mapboxLng, mapboxLat] = gcoord.transform([amapLng, amapLat], gcoord.GCJ02, gcoord.WGS84);

            return {
              id: poi.id,
              name: poi.name,
              address: poi.address?.trim() || '地址未知',
              category: poi.type?.trim() || '未知分类',
              mapboxLng,
              mapboxLat,
              amapLng,
              amapLat,
            };
          })
          .filter((item): item is SearchShopResult => item !== null);

        setResults(processedResults);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error('AMap search failed:', err);
      setError('搜索失败，请稍后重试');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute left-3 top-3 z-20 w-[320px] max-w-[calc(100%-24px)] rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-lg backdrop-blur-sm">
      <div className="flex gap-2">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="搜店名，如：喜茶 澳门"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? '...' : '搜索'}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      {results.length > 0 ? (
        <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
          {results.map((shop) => (
            <li key={shop.id}>
              <button
                type="button"
                className="w-full rounded-lg border border-transparent px-3 py-2 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
                onClick={() => onShopSelect?.(shop)}
              >
                <p className="text-sm font-semibold text-slate-900">{shop.name}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{shop.address}</p>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        keyword.trim().length > 0 && !loading && <p className="mt-3 text-xs text-slate-500">暂无匹配结果</p>
      )}
    </div>
  );
}
