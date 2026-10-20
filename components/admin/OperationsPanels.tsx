'use client';

import {useState} from 'react';
import type {CountItem, DataBlock, OperationsReport, QualityFilter} from '@/lib/admin/operations';

export const PANEL = 'min-w-0 rounded-2xl border border-line bg-white p-5';
export const BUTTON = 'min-h-11 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-50';
export const formatOpsTime = (value: string | number) => new Date(value).toLocaleString('zh-CN', {
  timeZone: 'Asia/Macau', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
});

export function DataNotice({block}: {block: DataBlock<unknown>}) {
  if (block.error) return <p role="alert" className="mt-3 text-sm leading-6 text-amber-900">{block.error}</p>;
  return <p className="mt-3 text-xs leading-5 text-muted">{block.incomplete
    ? `当前仅加载最近 ${block.loaded.toLocaleString()} 条，共 ${block.total?.toLocaleString() ?? '未知'} 条；以下结果不代表完整期间总量。`
    : `基于 ${block.loaded.toLocaleString()} 条记录。`}</p>;
}

export function CountRanking({items, empty}: {items: CountItem[]; empty: string}) {
  const max = Math.max(...items.map(item => item.count), 1);
  return items.length ? <ol className="mt-4 space-y-3">{items.map(item => <li key={item.label} className="min-w-0">
    <div className="mb-1 flex items-start justify-between gap-4 text-sm"><span className="min-w-0 break-all text-ink">{item.label}</span><span className="shrink-0 tabular-nums text-muted">{item.count.toLocaleString()} 次</span></div>
    <div className="h-1.5 rounded-full bg-canvas"><div className="h-full rounded-full bg-pine-700/70" style={{width: `${item.count / max * 100}%`}} /></div>
  </li>)}</ol> : <p className="mt-4 text-sm text-muted">{empty}</p>;
}

export function QualityPanel({block, onQuality, onEdit}: {block: OperationsReport['quality']; onQuality: (filter: QualityFilter) => void; onEdit: (id: string) => void}) {
  const quality = block.data;
  return <section className={PANEL} aria-label="地点内容质量">
    <h2 className="text-lg font-semibold text-ink">地点内容质量</h2>
    <p className="mt-1 text-xs leading-5 text-muted">仅检查已发布的新地点资料；同一地点可能存在多个问题。不自动修改资料。</p>
    <DataNotice block={block} />
    {quality && <>
      <div className="mt-4 grid grid-cols-3 gap-2">{([
        ['cover', '缺图片', quality.missingCover], ['address', '缺地址', quality.missingAddress], ['coordinates', '缺坐标', quality.missingCoordinates]
      ] as const).map(([filter, label, count]) => <button key={filter} type="button" onClick={() => onQuality(filter)}
        className="min-h-20 rounded-xl border border-line bg-canvas p-3 text-left hover:border-pine-700"><span className="text-xs text-muted">{label}</span><strong className="mt-1 block text-2xl font-semibold tabular-nums text-ink">{count}</strong></button>)}</div>
      <ul className="mt-4 divide-y divide-line">{quality.issues.slice(0, 5).map(item => <li key={item.id} className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0"><p className="break-words text-sm font-medium text-ink">{item.name}</p><p className="mt-1 text-xs text-muted">{item.reasons.join(' · ')}</p></div>
        <button type="button" className={`${BUTTON} shrink-0`} onClick={() => onEdit(item.id)} aria-label={`完善${item.name}`}>完善</button>
      </li>)}</ul>
      {!quality.issues.length && <p className="mt-4 text-sm text-muted">已加载的已发布地点中，没有发现上述资料缺失。</p>}
    </>}
  </section>;
}

export function SearchPanel({block}: {block: OperationsReport['searches']}) {
  const data = block.data;
  return <section className={PANEL} aria-label="搜索需求分析">
    <h2 className="text-lg font-semibold text-ink">同学想找什么</h2>
    <DataNotice block={block} />
    {data && <>
      <p className="mt-3 text-sm leading-6 text-muted">已记录 {data.total} 次搜索，其中 {data.missed} 次没有结果，{data.filterOnly} 次只有筛选条件。次数不等于人数，历史记录也可能含测试搜索。</p>
      <div className="mt-5 grid gap-6 sm:grid-cols-2"><div><h3 className="text-sm font-semibold text-ink">热门搜索词</h3><CountRanking items={data.popular} empty="暂无关键词搜索记录。" /></div>
        <div><h3 className="text-sm font-semibold text-ink">无结果关键词 · 优先补充线索</h3><CountRanking items={data.missing} empty="暂无无结果关键词。" /></div></div>
      <p className="mt-5 text-xs leading-5 text-muted">无结果可能来自资料缺失、别名不匹配或筛选过严，需要核实后再补充；空关键词不参与词榜。</p>
    </>}
  </section>;
}

export function ActivityPanel({block, compact = false}: {block: OperationsReport['activity']; compact?: boolean}) {
  return <section className={PANEL} aria-label="管理员操作记录">
    <h2 className="text-lg font-semibold text-ink">最近管理操作</h2>
    <p className="mt-1 text-xs leading-5 text-muted">澳门时间 · 展示已写入审计表的操作；不代表所有访问或所有历史修改。</p>
    <DataNotice block={block} />
    {block.data && <ul className="mt-4 divide-y divide-line">{block.data.slice(0, compact ? 5 : 30).map(item => <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
      <div className="min-w-0"><p className="break-words font-medium text-ink">{item.action} · {item.target}</p><p className="mt-1 text-xs text-muted">{item.entity} · {item.actor}</p></div>
      <time dateTime={item.createdAt} className="text-xs text-muted">{formatOpsTime(item.createdAt)}</time>
    </li>)}</ul>}
    {block.data?.length === 0 && <p className="mt-4 text-sm text-muted">所选时间内暂无已记录的管理操作。</p>}
  </section>;
}

export function VisitDetails({traffic}: {traffic: NonNullable<OperationsReport['traffic']['data']>}) {
  const [device, setDevice] = useState('all');
  const [source, setSource] = useState('all');
  const [page, setPage] = useState(0);
  const rows = traffic.recent.filter(row => (device === 'all' || row.device === device) && (source === 'all' || row.source === source));
  const lastPage = Math.max(0, Math.ceil(rows.length / 10) - 1);
  const currentPage = Math.min(page, lastPage);
  return <section className={PANEL} aria-label="最近访问明细">
    <h2 className="text-lg font-semibold text-ink">最近访问明细</h2>
    <p className="mt-1 text-xs leading-5 text-muted">所选期间最近 {traffic.recent.length} 条已加载前台访问；筛选仅作用于这些明细。浏览器编号只在本次报告内有效。</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <select aria-label="按设备筛选明细" value={device} onChange={event => {setDevice(event.target.value); setPage(0);}} className={BUTTON}>
        <option value="all">全部设备</option>{traffic.devices.map(item => <option key={item.label}>{item.label}</option>)}
      </select>
      <select aria-label="按来源筛选明细" value={source} onChange={event => {setSource(event.target.value); setPage(0);}} className={`${BUTTON} max-w-full`}>
        <option value="all">全部来源</option>{traffic.sources.map(item => <option key={item.label}>{item.label}</option>)}
      </select>
    </div>
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><caption className="sr-only">访问时间、页面路径、设备、来源及登录状态</caption>
      <thead className="border-b border-line text-xs text-muted"><tr>{['时间', '页面', '浏览器 / 设备', '来源', '登录状态'].map(label => <th key={label} scope="col" className="px-2 py-3 font-medium">{label}</th>)}</tr></thead>
      <tbody className="divide-y divide-line">{rows.slice(currentPage * 10, currentPage * 10 + 10).map(row => <tr key={row.id}>
        <td className="whitespace-nowrap px-2 py-3">{formatOpsTime(row.createdAt)}</td><td className="max-w-60 break-all px-2 py-3">{row.path}</td>
        <td className="px-2 py-3"><span className="block whitespace-nowrap">{row.browser}</span><span className="text-xs text-muted">{row.device}</span></td>
        <td className="max-w-52 break-all px-2 py-3">{row.source}</td><td className="whitespace-nowrap px-2 py-3">{row.signedIn ? '已登录' : '未记录账号'}</td>
      </tr>)}</tbody></table></div>
    {!rows.length && <p className="py-6 text-sm text-muted">没有符合条件的已加载记录。</p>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted"><span>共 {rows.length} 条 · 第 {currentPage + 1} / {lastPage + 1} 页</span><div className="flex gap-2">
      <button type="button" disabled={currentPage === 0} className={BUTTON} onClick={() => setPage(currentPage - 1)}>上一页</button>
      <button type="button" disabled={currentPage === lastPage} className={BUTTON} onClick={() => setPage(currentPage + 1)}>下一页</button>
    </div></div>
  </section>;
}
