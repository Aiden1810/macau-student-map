'use client';
import {useEffect, useState} from 'react';
import {adminEditorRequest} from './PlaceEditor';
import type {TrafficRange} from '@/lib/admin/traffic';

export const RANGE_LABELS = {
  '24h': '近 24 小时',
  '7d': '近 7 天',
  '30d': '近 30 天',
} as const;
export const RANGE_NOTES = {
  '24h': '滚动 24 小时，按小时统计',
  '7d': '含今天的 7 个澳门自然日',
  '30d': '含今天的 30 个澳门自然日',
} as const;
export const STATS_BUTTON =
  'min-h-11 rounded-xl border border-line bg-white px-3 text-sm text-ink disabled:opacity-50';
export function useAdminReport<T>(path: string, range: TrafficRange) {
  const [data, setData] = useState<T | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 25000);
    setData(null);
    setLoading(true);
    setError(false);
    void adminEditorRequest<T>(`${path}?range=${range}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((result) => {
        if (current) setData(result);
      })
      .catch(() => {
        if (current) setError(true);
      })
      .finally(() => {
        window.clearTimeout(timer);
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [path, range, revision]);
  return {
    data,
    loading,
    error,
    refresh: () => setRevision((value) => value + 1),
  };
}
export function StatsRange({
  range,
  onChange,
}: {
  range: TrafficRange;
  onChange: (range: TrafficRange) => void;
}) {
  return (
    <div
      role="group"
      aria-label="统计时间范围"
      className="flex flex-wrap gap-2"
    >
      {(['24h', '7d', '30d'] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={range === value}
          onClick={() => onChange(value)}
          className={`${STATS_BUTTON} ${range === value ? 'border-pine-700 bg-pine-50 font-semibold text-pine-800' : ''}`}
        >
          {RANGE_LABELS[value]}
        </button>
      ))}
    </div>
  );
}
export function StatsCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number | null;
  note?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-white p-4">
      <p className="text-sm text-muted">{label}</p>
      <p
        aria-label={label}
        className="mt-2 break-words text-2xl font-semibold tabular-nums text-ink"
      >
        {value ?? '—'}
      </p>
      {note && (
        <p className="mt-2 text-xs leading-relaxed text-muted">{note}</p>
      )}
    </div>
  );
}
export function ReportBars({
  points,
  label,
}: {
  points: Array<{timestamp: number; label: string; count: number}>;
  label: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.count));
  return (
    <div
      className="mt-4 rounded-xl border border-line bg-canvas px-3 py-4"
      role="img"
      aria-label={label}
    >
      <div className="flex h-28 items-end gap-1" aria-hidden="true">
        {points.map((point) => (
          <div
            key={point.timestamp}
            title={`${point.label}：${point.count}`}
            className="flex h-full min-w-0 flex-1 items-end"
          >
            <div
              className={`w-full rounded-t ${point.count ? 'bg-pine-600' : 'bg-line'}`}
              style={{height: `${Math.max(2, (point.count / max) * 100)}%`}}
            />
          </div>
        ))}
      </div>
      <div
        className="mt-2 flex justify-between gap-3 text-[11px] text-muted"
        aria-hidden="true"
      >
        <span>{points[0]?.label}</span>
        <span>{points.at(-1)?.label}</span>
      </div>
      <p className="sr-only">
        {points.map((point) => `${point.label}：${point.count}`).join('；')}
      </p>
    </div>
  );
}
export function statsTime(timestamp: number | null) {
  return timestamp === null
    ? '尚无记录'
    : new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Macau',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(timestamp);
}
