'use client';

import type {AdminSection} from './AdminNavigation';
import type {PlaceSummary} from './PlacesManager';
import type {QueueStats} from './SubmissionQueue';
import type {FeedbackStats} from './FeedbackInbox';

export default function AdminQuickLinks({places, queue, feedback, onChange}: {
  places: PlaceSummary | null; queue: QueueStats | null; feedback: FeedbackStats | null; onChange: (section: AdminSection) => void;
}) {
  return <section className="mb-7 grid gap-3 sm:grid-cols-3" aria-label="管理快捷入口">
    <button type="button" onClick={() => onChange('places')} className="group rounded-2xl bg-pine-800 p-5 text-left text-white">
      <span className="text-sm text-white/75">店铺资料</span>
      <div className="mt-3 flex items-end justify-between gap-3"><span className="text-3xl font-semibold tabular-nums">{places?.published ?? '—'} <span className="text-sm font-normal text-white/80">已发布</span></span><span className="text-sm text-white/80 group-hover:text-white">去管理 →</span></div>
      <p className="mt-3 text-xs leading-5 text-white/75">{places ? `另有 ${places.draft} 个草稿、${places.archived} 个已归档。基于已加载的新地点资料（最多 500 条）。` : '地点数据正在读取或暂不可用。'}</p>
    </button>
    <button type="button" onClick={() => onChange('feedback')} className="group rounded-2xl border border-line bg-white p-5 text-left"><span className="text-sm text-muted">用户的声音</span><div className="mt-3 flex items-end justify-between gap-3"><span className="text-3xl font-semibold tabular-nums text-ink">{feedback?.pending ?? '—'} <span className="text-sm font-normal text-muted">条待处理反馈</span></span><span className="text-sm text-pine-700 group-hover:underline">查看 →</span></div><p className="mt-3 text-xs leading-5 text-muted">问题、纠错和投诉集中处理。</p></button>
    <button type="button" onClick={() => onChange('submissions')} className="group rounded-2xl border border-line bg-white p-5 text-left">
      <span className="text-sm text-muted">需要你处理</span>
      <div className="mt-3 flex items-end justify-between gap-3"><span className="text-3xl font-semibold tabular-nums text-ink">{queue?.pending ?? '—'} <span className="text-sm font-normal text-muted">条待审核投稿</span></span><span className="text-sm text-pine-700 group-hover:underline">去审核 →</span></div>
      <p className="mt-3 text-xs leading-5 text-muted">审核完整资料和图片后，再发布到用户地图。</p>
    </button>
  </section>;
}
