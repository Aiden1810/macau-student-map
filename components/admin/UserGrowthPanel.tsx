'use client';
import {useState} from 'react';
import type {RegistrationStats} from '@/lib/admin/dashboard-stats';
import type {TrafficRange} from '@/lib/admin/traffic';
import {
  RANGE_NOTES,
  ReportBars,
  STATS_BUTTON,
  StatsCard,
  StatsRange,
  statsTime,
  useAdminReport,
} from './DashboardStatsPanels';
export default function UserGrowthPanel() {
  const [range, setRange] = useState<TrafficRange>('7d');
  const {data, loading, error, refresh} = useAdminReport<RegistrationStats>(
    '/api/admin/users/stats',
    range,
  );
  return (
    <section
      aria-label="注册增长统计"
      className="mt-5 rounded-xl border border-line bg-canvas p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-ink">注册增长</h3>
        <button
          type="button"
          disabled={loading}
          onClick={refresh}
          className={STATS_BUTTON}
        >
          刷新统计
        </button>
      </div>
      <div className="mt-3">
        <StatsRange range={range} onChange={setRange} />
      </div>
      <p className="mt-3 text-xs text-muted">
        {RANGE_NOTES[range]}；已删除和匿名登录账号不计入。
      </p>
      <div className="mt-4">
        <StatsCard
          label="新增注册账号数"
          value={data?.newUsers ?? null}
          note={
            data ? `统计更新于澳门时间 ${statsTime(data.updatedAt)}` : undefined
          }
        />
      </div>
      {loading && (
        <p role="status" className="mt-3 text-sm text-muted">
          正在读取注册趋势…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-800">
          注册统计读取失败，请刷新重试。
        </p>
      )}
      {data && (
        <ReportBars
          points={data.timeline}
          label="按注册时间统计的新增账号趋势"
        />
      )}
    </section>
  );
}
