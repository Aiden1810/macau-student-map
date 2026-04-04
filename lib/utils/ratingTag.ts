import {ShopRatingLabel} from '@/types/shop';

export type RatingTag = {
  label: ShopRatingLabel;
  bgClass: string;
  textClass: string;
  borderClass: string;
};

const RATING_LABELS: ShopRatingLabel[] = ['封神之作', '强烈推荐', '还行吧', '建议避雷', '暂无评分'];

function isRatingLabel(value: string): value is ShopRatingLabel {
  return (RATING_LABELS as readonly string[]).includes(value);
}

function tagForLabel(label: ShopRatingLabel): RatingTag {
  if (label === '封神之作') {
    return {
      label: '封神之作',
      bgClass: 'bg-yellow-100',
      textClass: 'text-yellow-700',
      borderClass: 'border-yellow-300'
    };
  }

  if (label === '强烈推荐') {
    return {
      label: '强烈推荐',
      bgClass: 'bg-green-100',
      textClass: 'text-green-700',
      borderClass: 'border-green-300'
    };
  }

  if (label === '还行吧') {
    return {
      label: '还行吧',
      bgClass: 'bg-slate-100',
      textClass: 'text-slate-700',
      borderClass: 'border-slate-300'
    };
  }

  if (label === '建议避雷') {
    return {
      label: '建议避雷',
      bgClass: 'bg-red-100',
      textClass: 'text-red-500',
      borderClass: 'border-red-200'
    };
  }

  return {
    label: '暂无评分',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-500',
    borderClass: 'border-gray-200'
  };
}

export function getRatingTag(score: number): RatingTag {
  const safeScore = Number.isFinite(score) ? score : 0;

  if (safeScore >= 5) {
    return tagForLabel('封神之作');
  }

  if (safeScore >= 4) {
    return tagForLabel('强烈推荐');
  }

  if (safeScore >= 3) {
    return tagForLabel('还行吧');
  }

  if (safeScore >= 1) {
    return tagForLabel('建议避雷');
  }

  return tagForLabel('暂无评分');
}

export function getRatingTagFromData(
  score: number,
  tags: string[] = [],
  subTags: string[] = [],
  explicitRatingLabel?: string | null
): RatingTag {
  if (explicitRatingLabel && isRatingLabel(explicitRatingLabel)) {
    if (!(explicitRatingLabel === '暂无评分' && Number.isFinite(score) && score > 0)) {
      return tagForLabel(explicitRatingLabel);
    }
  }

  const mergedLabels = [...subTags, ...tags]
    .map((item) => item.trim())
    .filter((item): item is ShopRatingLabel => isRatingLabel(item));

  const explicitPriority: ShopRatingLabel[] = ['封神之作', '强烈推荐', '还行吧', '建议避雷', '暂无评分'];
  const explicit = explicitPriority.find((label) => mergedLabels.includes(label));

  if (explicit && !(explicit === '暂无评分' && Number.isFinite(score) && score > 0)) {
    return tagForLabel(explicit);
  }

  return getRatingTag(score);
}
