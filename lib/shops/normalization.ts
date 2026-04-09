import {ShopRegion, ShopRatingLabel} from '@/types/shop';

export function dedupeTrimmedList(list: string[], limit?: number): string[] {
  const normalized = Array.from(new Set(list.map((item) => item.trim()).filter(Boolean)));
  return typeof limit === 'number' ? normalized.slice(0, limit) : normalized;
}

export function deriveRatingLabelFromScore(score: number): ShopRatingLabel {
  if (score >= 5) return '封神之作';
  if (score >= 4) return '强烈推荐';
  if (score >= 2) return '还行吧';
  if (score >= 1) return '建议避雷';
  return '暂无评分';
}

export function deriveRegionFromCoordinates(longitude: number | null, latitude: number | null): ShopRegion | null {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }

  const lng = Number(longitude);
  const lat = Number(latitude);

  // 澳门半岛（近似）
  if (lng >= 113.52 && lng <= 113.57 && lat >= 22.18 && lat <= 22.23) {
    return '澳门半岛';
  }

  // 氹仔岛（近似）
  if (lng >= 113.55 && lng <= 113.59 && lat >= 22.14 && lat <= 22.17) {
    return '氹仔岛';
  }

  // 路环岛（近似）
  if (lng >= 113.55 && lng <= 113.61 && lat >= 22.10 && lat <= 22.14) {
    return '路环岛';
  }

  // 横琴区（近似）
  if (lng >= 113.50 && lng <= 113.62 && lat >= 22.08 && lat <= 22.16) {
    return '横琴区';
  }

  // 香洲区（珠海主城区近似）
  if (lng >= 113.48 && lng <= 113.63 && lat >= 22.20 && lat <= 22.33) {
    return '香洲区';
  }

  // 澳门及珠海大范围兜底
  if (lng >= 113 && lng <= 114.2 && lat >= 21.8 && lat <= 22.6) {
    return '其它';
  }

  return null;
}
