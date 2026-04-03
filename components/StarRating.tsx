import {Star, StarHalf} from 'lucide-react';

interface StarRatingProps {
  score: number;
  reviewCount?: number;
}

export default function StarRating({score, reviewCount}: StarRatingProps) {
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.min(5, score)) : 0;
  const fullStars = Math.floor(safeScore);
  const hasHalfStar = safeScore - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  if (safeScore <= 0) {
    return <span className="text-xs text-slate-400">暂无评分</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({length: fullStars}).map((_, index) => (
          <Star key={`full-${index}`} className="h-4 w-4 fill-amber-400 text-amber-400" />
        ))}

        {hasHalfStar && <StarHalf className="h-4 w-4 fill-amber-400 text-amber-400" />}

        {Array.from({length: emptyStars}).map((_, index) => (
          <Star key={`empty-${index}`} className="h-4 w-4 text-slate-300" />
        ))}
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-sm font-bold text-slate-700">{safeScore.toFixed(1)}</span>
        {typeof reviewCount === 'number' && <span className="text-xs text-slate-400">({reviewCount} 条评论)</span>}
      </div>
    </div>
  );
}
