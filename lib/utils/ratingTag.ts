export type RatingTag = {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
};

export function getRatingTag(score: number): RatingTag {
  const safeScore = Number.isFinite(score) ? score : 0;

  if (safeScore >= 5) {
    return {
      label: '封神之作',
      bgClass: 'bg-yellow-100',
      textClass: 'text-yellow-700',
      borderClass: 'border-yellow-300'
    };
  }

  if (safeScore >= 4) {
    return {
      label: '值得一试',
      bgClass: 'bg-green-100',
      textClass: 'text-green-700',
      borderClass: 'border-green-300'
    };
  }

  if (safeScore >= 3) {
    return {
      label: '中规中矩',
      bgClass: 'bg-orange-100',
      textClass: 'text-orange-700',
      borderClass: 'border-orange-300'
    };
  }

  if (safeScore >= 2) {
    return {
      label: '建议避雷',
      bgClass: 'bg-red-100',
      textClass: 'text-red-500',
      borderClass: 'border-red-200'
    };
  }

  if (safeScore >= 1) {
    return {
      label: '千万别去',
      bgClass: 'bg-red-100',
      textClass: 'text-red-700',
      borderClass: 'border-red-300'
    };
  }

  return {
    label: '暂无评分',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-500',
    borderClass: 'border-gray-200'
  };
}
