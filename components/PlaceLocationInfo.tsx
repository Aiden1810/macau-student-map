import {getLocationNotice, type LocationDetails} from '@/lib/domain/location-details';

export default function PlaceLocationInfo({details, compact = false}: {details?: LocationDetails; compact?: boolean}) {
  if (!details) return null;
  const notice = getLocationNotice(details);
  const badges = [details.businessForm === 'stall' ? '小摊' : null,
    details.accuracy === 'approximate' ? '大致位置' : details.source === 'manual' && details.accuracy === 'unknown' ? '位置待确认' : null,
    details.mobility === 'variable' ? '位置可能变化' : null].filter(Boolean);
  if (compact) return badges.length ? <span className="inline-flex flex-wrap gap-1">{badges.map(badge => <span key={badge} className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">{badge}</span>)}</span> : null;
  if (!badges.length && !details.description && !details.landmark && !details.hours) return null;
  return <div className="mt-3 space-y-2 break-words text-sm leading-6 text-slate-700">
    {badges.length > 0 && <PlaceLocationInfo details={details} compact />}
    {details.description && <p className="whitespace-pre-wrap"><span className="font-medium">怎么找：</span>{details.description}</p>}
    {details.landmark && <p><span className="font-medium">参考地标：</span>{details.landmark}</p>}
    {details.hours && <p><span className="font-medium">营业／出摊时间：</span>{details.hours}<span className="block text-xs text-slate-500">时间仅供参考，不代表当前出摊或营业状态。</span></p>}
    {notice && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{notice}</p>}
  </div>;
}
