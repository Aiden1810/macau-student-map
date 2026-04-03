export type RatingTag = {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
};

const RATING_LABELS = ['封神之作', '值得一试', '中规中矩', '建议避雷', '暂无评分'] as const;

type RatingLabel = (typeof RATING_LABELS)[number];

function isRatingLabel(value: string): value is RatingLabel {
  return (RATING_LABELS as readonly string[]).includes(value);
}

function tagForLabel(label: RatingLabel): RatingTag {
  if (label === '封神之作') {
    return {
      label: '封神之作',
      bgClass: 'bg-yellow-100',
      textClass: 'text-yellow-700',
      borderClass: 'border-yellow-300'
    };
  }

  if (label === '值得一试') {
    return {
      label: '值得一试',
      bgClass: 'bg-green-100',
      textClass: 'text-green-700',
      borderClass: 'border-green-300'
    };
  }

  if (label === '中规中矩') {
    return {
      label: '中规中矩',
      bgClass: 'bg-orange-100',
      textClass: 'text-orange-700',
      borderClass: 'border-orange-300'
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
    return tagForLabel('值得一试');
  }

  if (safeScore >= 3) {
    return tagForLabel('中规中矩');
  }

  if (safeScore >= 2) {
    return tagForLabel('建议避雷');
  }

  return tagForLabel('暂无评分');
}

export function getRatingTagFromData(score: number, tags: string[] = [], subTags: string[] = []): RatingTag {
  const mergedLabels = [...subTags, ...tags]
    .map((item) => item.trim())
    .filter((item): item is RatingLabel => isRatingLabel(item));

  const explicitPriority: RatingLabel[] = ['封神之作', '值得一试', '中规中矩', '建议避雷', '暂无评分'];
  const explicit = explicitPriority.find((label) => mergedLabels.includes(label));

  if (explicit && !(explicit === '暂无评分' && Number.isFinite(score) && score > 0)) {
    return tagForLabel(explicit);
  }

  return getRatingTag(score);
}
