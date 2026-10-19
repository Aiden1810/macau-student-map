import {summarizeBulkResults, type BulkPlaceResult} from '@/lib/admin/bulk-place-selection';

export type NamedBulkPlaceResult = BulkPlaceResult & {name: string};
export default function BulkPlaceStatusResult({results}: {results: NamedBulkPlaceResult[]}) {
  const counts = summarizeBulkResults(results);
  return <section aria-label="上次批量操作结果" className="mt-4 rounded-xl border border-line bg-canvas p-4 text-sm">
    <p role="status" className="font-medium text-ink">成功 {counts.updated} 家 · 无需修改 {counts.unchanged} 家 · 未成功或待确认 {counts.failed} 家</p>
    {counts.failed > 0 && <>
      <p className="mt-2 text-xs text-muted">仍符合当前筛选的失败项会保留勾选。请查看原因，并在列表刷新完成后重试；操作结果待确认时，先核对实际状态。</p>
    </>}
    <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-slate-700">
      {results.map(item => <li key={item.id} className="break-words">
        <span className="font-medium">{item.name}</span>：{item.outcome === 'updated' ? '操作成功' : item.outcome === 'unchanged' ? '已是目标状态，无需修改' : item.message}
      </li>)}
    </ul>
  </section>;
}
