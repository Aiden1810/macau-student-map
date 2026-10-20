'use client';

import {useEffect, useState} from 'react';
import {ArrowUpRight, RefreshCw} from 'lucide-react';
import {adminEditorRequest} from './PlaceEditor';
import type {AdminSection} from './AdminNavigation';
import AdminQuickLinks from './AdminQuickLinks';
import TrafficOverview from './TrafficOverview';
import type {PlaceSummary} from './PlacesManager';
import type {QueueStats} from './SubmissionQueue';
import type {FeedbackStats} from './FeedbackInbox';
import {ActivityPanel, BUTTON, CountRanking, DataNotice, PANEL, QualityPanel, SearchPanel, VisitDetails, formatOpsTime} from './OperationsPanels';
import type {OperationsReport, QualityFilter} from '@/lib/admin/operations';
import type {TrafficRange} from '@/lib/admin/traffic';

export default function PlatformDashboard({section, places, queue, feedback, onChange, onQuality, onEditPlace, refreshSignal = 0}: {
  section: AdminSection; places: PlaceSummary | null; queue: QueueStats | null; feedback: FeedbackStats | null;
  onChange: (section: AdminSection) => void; onQuality: (filter: QualityFilter) => void;
  onEditPlace: (id: string) => void; refreshSignal?: number;
}) {
  const [range, setRange] = useState<TrafficRange>('7d');
  const [report, setReport] = useState<OperationsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const active = ['overview', 'analytics', 'activity'].includes(section);
  useEffect(() => {
    if (!active) return;
    let current = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 25000);
    setLoading(true); setError(false); setReport(null);
    void adminEditorRequest<OperationsReport>(`/api/admin/operations?range=${range}`, {cache: 'no-store', signal: controller.signal})
      .then(data => {if (current) setReport(data);})
      .catch(() => {if (current) setError(true);})
      .finally(() => {window.clearTimeout(timer); if (current) setLoading(false);});
    return () => {current = false; window.clearTimeout(timer); controller.abort();};
  }, [active, range, reload, refreshSignal]);
  if (!active) return null;
  const refresh = () => setReload(value => value + 1);
  const traffic = report?.traffic.data;
  const quality = report?.quality.data;
  return <div className="space-y-6">
    <section className="flex flex-wrap items-start justify-between gap-4" aria-label="平台工作台">
      <div><p className="text-xs font-medium tracking-widest text-pine-700">PLATFORM OPERATIONS</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{section === 'overview' ? '先处理待办，再看使用情况' : section === 'analytics' ? '了解访问与内容需求' : '管理操作有迹可查'}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{range === '24h' ? '最近 24 小时' : `最近 ${range === '7d' ? '7' : '30'} 个自然日（含今天）`} · 澳门时间{report && ` · 更新于 ${formatOpsTime(report.updatedAt)}`}</p>
      </div>
      <div className="flex flex-wrap gap-2"><div className="flex rounded-xl border border-line bg-white p-1" aria-label="工作台时间范围">
        {([['24h', '24 小时'], ['7d', '7 天'], ['30d', '30 天']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)}
          className={`min-h-10 rounded-lg px-3 text-sm font-medium ${range === value ? 'bg-pine-700 text-white' : 'text-muted'}`}>{label}</button>)}
      </div><button type="button" className={`${BUTTON} inline-flex items-center gap-2`} disabled={loading} onClick={refresh}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />刷新工作台</button></div>
    </section>
    {loading && <div role="status" className={`${PANEL} animate-pulse motion-reduce:animate-none text-sm text-muted`}>正在读取工作台…</div>}
    {error && <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">工作台读取失败，请点击“刷新工作台”重试。读取失败不代表没有数据。</div>}
    {report && <>
      {section === 'overview' && <>
        <AdminQuickLinks places={quality ? {total: quality.total, published: quality.published, draft: quality.draft, archived: quality.archived} : places}
          queue={queue} feedback={feedback} reviews={report.pendingReviews.data} reviewError={report.pendingReviews.error} onChange={onChange} />
        <div className={`${PANEL} flex flex-wrap items-center justify-between gap-4`}>
          <div><h3 className="font-semibold text-ink">网站使用概况</h3><p className="mt-1 text-xs text-muted">页面浏览与去重浏览器是使用线索，不能当作实际人数。</p></div>
          <button type="button" className={`${BUTTON} inline-flex items-center gap-2`} onClick={() => onChange('analytics')}>查看数据分析<ArrowUpRight size={16} /></button>
          {traffic ? <div className="grid w-full gap-4 border-t border-line pt-4 sm:grid-cols-3">{[
            ['页面浏览', traffic.summary.pv], ['去重浏览器', traffic.summary.uv], ['搜索次数', report.searches.data?.total ?? '—']
          ].map(([label, value]) => <div key={label}><p className="text-xs text-muted">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums text-ink">{value.toLocaleString()}</p></div>)}</div> : <DataNotice block={report.traffic} />}
          {traffic && <DataNotice block={report.traffic} />}
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-2"><QualityPanel block={report.quality} onQuality={onQuality} onEdit={onEditPlace} /><SearchPanel block={report.searches} /></div>
        <div className="flex items-center justify-between"><h3 className="text-sm font-medium text-muted">工作台待办与地点质量为当前快照，不随上方时间范围变化。</h3><button type="button" className={BUTTON} onClick={() => onChange('activity')}>全部操作记录</button></div>
        <ActivityPanel block={report.activity} compact />
      </>}
      {section === 'analytics' && <>
        <TrafficOverview summary={traffic?.summary ?? {pv: 0, uv: 0, identifiedViews: 0, timeline: [], topPages: [], peakPoint: null}} range={range} onRangeChange={setRange}
          onRefresh={refresh} refreshing={loading} error={report.traffic.error} loadedCount={report.traffic.loaded} totalCount={report.traffic.total} updatedAt={report.updatedAt} />
        {traffic && <>
          <div className="grid items-start gap-5 lg:grid-cols-3">{[
            ['设备分布', traffic.devices], ['访问来源', traffic.sources.slice(0, 10)], ['重复访问较多的浏览器', traffic.frequentBrowsers]
          ].map(([title, items]) => <section key={title as string} className={PANEL}><h3 className="font-semibold text-ink">{title as string}</h3><CountRanking items={items as typeof traffic.devices} empty="暂无记录。" /></section>)}</div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
            历史访问没有运行环境字段，无法准确区分正式访问与测试流量。{traffic.localReferrerViews > 0 && `发现 ${traffic.localReferrerViews} 次本机来源，但来源不等于页面运行环境。`}
            设备和疑似自动化由浏览器声明估计，不能据此确认真人；没有来源也不代表用户一定直接输入网址。分布按浏览次数统计。
          </div>
          <VisitDetails key={`${range}-${report.updatedAt}`} traffic={traffic} />
          <section className={PANEL}><h2 className="text-lg font-semibold text-ink">地点详情页热度</h2><p className="mt-1 text-xs leading-5 text-muted">只统计已记录的独立详情页浏览；首页弹窗打开、导航点击与实际到店不包含在内。</p>
            <CountRanking items={traffic.placeViews.slice(0, 10).map(item => ({label: report.quality.data?.places.find(place => place.id === item.id)?.name ?? `地点 ${item.id}`, count: item.count}))} empty="暂无已记录的地点详情页浏览。" />
          </section>
        </>}
        <SearchPanel block={report.searches} />
      </>}
      {section === 'activity' && <ActivityPanel block={report.activity} />}
    </>}
  </div>;
}
