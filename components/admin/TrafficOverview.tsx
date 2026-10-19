'use client';

import {Activity, ArrowUpRight, Eye, Monitor, RefreshCw} from 'lucide-react';
import type {TrafficRange, TrafficSummary} from '@/lib/admin/traffic';

export default function TrafficOverview({summary, range, onRangeChange, onRefresh, refreshing, error, loadedCount, totalCount, updatedAt}: {
  summary: TrafficSummary; range: TrafficRange; onRangeChange: (range: TrafficRange) => void;
  onRefresh: () => void; refreshing: boolean; error: string | null;
  loadedCount: number; totalCount: number | null; updatedAt: number;
}) {
  const max = Math.max(...summary.timeline.map(point => point.count), 1);
  const incomplete = totalCount === null || totalCount > loadedCount;
  const cards = [
    {label: '页面浏览', value: summary.pv.toLocaleString(), detail: '每次打开页面记为一次', Icon: Eye},
    {label: '去重浏览器', value: summary.uv.toLocaleString(), detail: '同一浏览器标识只计一次', Icon: Monitor},
    {label: '平均浏览页数', value: summary.uv ? (summary.identifiedViews / summary.uv).toFixed(1) : '—', detail: '仅计算带浏览器标识的浏览', Icon: ArrowUpRight}
  ];
  return <section aria-label="网站访问概况" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold text-ink">网站访问概况</h2><p className="mt-1 text-xs text-muted">{range === '24h' ? '最近 24 小时' : `最近 ${range === '7d' ? '7' : '30'} 个自然日（含今天）`} · 澳门时间</p></div>
      <div className="flex flex-wrap gap-2">
        <div aria-label="统计时间范围" className="flex rounded-xl border border-line bg-white p-1">{([{key: '24h', label: '24 小时'}, {key: '7d', label: '7 天'}, {key: '30d', label: '30 天'}] as const).map(item => <button key={item.key} type="button" aria-pressed={range === item.key} onClick={() => onRangeChange(item.key)} className={`min-h-10 rounded-lg px-3 text-sm font-medium transition ${range === item.key ? 'bg-pine-700 text-white' : 'text-muted hover:bg-slate-50'}`}>{item.label}</button>)}</div>
        <button type="button" onClick={onRefresh} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm text-ink disabled:opacity-50"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />{refreshing ? '刷新中' : '刷新数据'}</button>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">{cards.map(({label, value, detail, Icon}) => <div key={label} className="rounded-2xl border border-line bg-white p-5"><div className="flex items-center justify-between text-sm text-muted"><span>{label}</span><Icon size={18} className="text-pine-700" /></div><p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight text-ink">{error ? '—' : value}</p><p className="mt-2 text-xs text-muted">{error ? '数据暂不可用' : detail}</p></div>)}</div>
    {error ? <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><p className="font-semibold">访问数据暂不可用</p><p className="mt-1">请稍后点击“刷新数据”重试。读取失败不代表没有访问。</p></div> : <>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-ink">浏览趋势</h3><span className="text-xs text-muted">{range === '24h' ? '每小时' : '每天'} · 浏览次数</span></div>
          {summary.pv === 0 && <p className="mt-3 text-sm text-muted">所选时间内没有已记录的前台访问。</p>}
          <div className="mt-5 flex h-40 items-end gap-1 border-b border-line" role="img" aria-label={`浏览趋势，共 ${summary.pv} 次浏览。${summary.peakPoint ? `最高 ${summary.peakPoint.label}，${summary.peakPoint.count} 次。` : '暂无记录。'}`}>
            {summary.timeline.map(point => <div key={point.timestamp} title={`${point.label}：${point.count} 次`} className="flex h-full min-w-0 flex-1 items-end"><div className="w-full rounded-t bg-pine-700/80 transition-[height] motion-reduce:transition-none" style={{height: `${point.count / max * 100}%`}} /></div>)}
          </div>
          <div className="mt-2 flex justify-between gap-2 text-[11px] text-muted"><span>{summary.timeline[0]?.label}</span><span>{summary.timeline.at(-1)?.label}</span></div>
          <details className="mt-4 text-xs text-muted"><summary className="cursor-pointer py-2">查看逐时／逐日数据</summary><div className="mt-2 grid max-h-48 grid-cols-2 gap-x-6 gap-y-2 overflow-y-auto pr-2">{summary.timeline.map(point => <div key={point.timestamp} className="flex justify-between gap-2"><span>{point.label}</span><span className="font-medium text-ink">{point.count}</span></div>)}</div></details>
        </div>
        <div className="min-w-0 rounded-2xl border border-line bg-white p-5"><h3 className="font-semibold text-ink">大家在看什么</h3><p className="mt-1 text-xs text-muted">浏览最多的 5 个页面</p><ol className="mt-4 space-y-2">{summary.topPages.map((page, index) => <li key={page.path} className="flex items-center gap-3 rounded-xl bg-[#f6f8f5] px-3 py-3 text-sm"><span className="text-xs tabular-nums text-muted">0{index + 1}</span><span className="min-w-0 flex-1 break-all text-ink" title={page.path}>{page.path}</span><span className="shrink-0 font-semibold tabular-nums text-pine-700">{page.count}</span></li>)}</ol>{summary.topPages.length === 0 && <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted"><Activity size={18} />暂无页面记录</div>}</div>
      </div>
      <div className="rounded-xl border border-line bg-white/60 px-4 py-3 text-xs leading-6 text-muted">
        <p>{incomplete ? `当前仅加载最近 ${loadedCount.toLocaleString()} 条浏览记录，图表可能不完整，不能当作完整期间总量。` : `基于 ${loadedCount.toLocaleString()} 条已加载记录，已排除后台和登录页面。`} {updatedAt > 0 && `更新于 ${new Date(updatedAt).toLocaleTimeString('zh-CN', {timeZone: 'Asia/Macau', hour: '2-digit', minute: '2-digit'})}。`}</p>
        <p>去重浏览器不等于实际人数：同一人换设备、清理存储或使用无痕模式会重复计算；拦截统计的访问可能未被记录。</p>
      </div>
    </>}
  </section>;
}
