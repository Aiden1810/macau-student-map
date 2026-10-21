'use client';

import {
  ArrowLeft,
  BarChart3,
  ClipboardCheck,
  Inbox,
  History,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Settings2,
  Store,
  Users
} from 'lucide-react';
import {Link} from '@/i18n/navigation';

export type AdminSection = 'overview' | 'analytics' | 'users' | 'places' | 'submissions' | 'reviews' | 'feedback' | 'activity' | 'tools';
const sections = [
  {key: 'overview', label: '总览', Icon: LayoutDashboard},
  {key: 'analytics', label: '数据分析', Icon: BarChart3},
  {key: 'users', label: '用户管理', Icon: Users},
  {key: 'places', label: '店铺资料', Icon: Store},
  {key: 'submissions', label: '投稿审核', Icon: ClipboardCheck},
  {key: 'reviews', label: '用户评价', Icon: MessageSquare},
  {key: 'feedback', label: '用户反馈', Icon: Inbox},
  {key: 'activity', label: '操作记录', Icon: History},
  {key: 'tools', label: '更多工具', Icon: Settings2}
] as const;

export default function AdminNavigation({
  section,
  onChange,
  onCreate
}: {
  section: AdminSection;
  onChange: (section: AdminSection) => void;
  onCreate: () => void;
}) {
  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pine-700 text-xl text-white"
          >
            觅
          </span>
          <div>
            <p className="text-xs font-medium tracking-widest text-pine-700">城觅 / CityU Food</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">管理工作台</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm text-ink"
          >
            <ArrowLeft size={16} />
            返回地图
          </Link>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-pine-700 px-4 text-sm font-semibold text-white hover:bg-pine-800"
          >
            <Plus size={17} />
            新增店铺
          </button>
        </div>
      </header>
      <nav
        aria-label="后台功能"
      className="mb-7 grid grid-cols-4 gap-1 rounded-2xl border border-line bg-white p-1.5 lg:flex lg:flex-wrap lg:gap-1"
      >
        {sections.map(({key, label, Icon}) => (
          <button
            key={key}
            type="button"
            aria-current={section === key ? 'page' : undefined}
            onClick={() => onChange(key)}
            className={`inline-flex min-h-12 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-xl px-0.5 py-2 text-[11px] font-medium transition sm:flex-row sm:gap-2 sm:px-5 sm:text-sm ${section === key ? 'bg-pine-700 text-white shadow-sm' : 'text-muted hover:bg-slate-50 hover:text-ink'}`}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}
