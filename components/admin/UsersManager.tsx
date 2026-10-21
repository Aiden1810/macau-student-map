'use client';

import {useEffect, useState, type FormEvent} from 'react';
import {adminEditorRequest} from './PlaceEditor';
import type {UserDirectory} from '@/lib/admin/accounts';

const buttonStyle = 'min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50';
const dateFormat = new Intl.DateTimeFormat('zh-CN', {timeZone: 'Asia/Macau', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false});

export default function UsersManager() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState({text: '', page: 1, revision: 0});
  const [data, setData] = useState<UserDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 25000);
    setLoading(true); setError(null); setData(null);
    void adminEditorRequest<UserDirectory>(`/api/admin/users?page=${query.page}&q=${encodeURIComponent(query.text)}`,
      {cache: 'no-store', signal: controller.signal})
      .then(result => {if (active) setData(result);})
      .catch(() => {if (active) setError('用户列表读取失败，请刷新重试。若刚更新代码，请确认用户管理数据库迁移已安装。');})
      .finally(() => {window.clearTimeout(timer); if (active) setLoading(false);});
    return () => {active = false; window.clearTimeout(timer); controller.abort();};
  }, [query]);
  const search = (event: FormEvent) => {
    event.preventDefault();
    setQuery(current => ({text: input.trim(), page: 1, revision: current.revision + 1}));
  };
  const pages = data ? Math.max(1, Math.ceil(data.matched / data.pageSize)) : 1;
  return <section className="rounded-2xl border border-line bg-white p-5 shadow-sm" aria-label="注册用户管理">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-semibold text-ink">用户管理</h2>
        <p className="mt-2 text-sm text-muted">查看注册账号和当前邮箱。注册账号数与浏览量、去重浏览器数分别统计。</p></div>
      <button type="button" disabled={loading} onClick={() => setQuery(current => ({...current, revision: current.revision + 1}))} className={buttonStyle}>
        {loading ? '正在读取…' : '刷新用户'}</button>
    </div>
    <div className="mt-5 rounded-xl border border-line bg-canvas p-4">
      <p className="text-sm text-muted">注册账号总数</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-pine-800" aria-live="polite">{data?.total ?? '—'}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted">统计当前未删除的注册账号，包含尚未完成邮箱验证的账号；不包含匿名访客。</p>
    </div>
    <form onSubmit={search} className="mt-5 flex flex-wrap gap-2">
      <label htmlFor="admin-user-search" className="sr-only">搜索邮箱或账号 ID</label>
      <input id="admin-user-search" value={input} maxLength={200} onChange={event => setInput(event.target.value)} placeholder="搜索邮箱或账号 ID"
        className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-pine-700 focus:ring-2 focus:ring-pine-700/15" />
      <button type="submit" className="min-h-11 rounded-xl bg-pine-700 px-5 text-sm font-medium text-white hover:bg-pine-800">搜索</button>
    </form>
    {loading && <p role="status" className="mt-5 text-sm text-muted">正在读取用户列表…</p>}
    {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {data && <>
      <p className="mt-4 text-sm text-muted" role="status">符合条件 {data.matched} 个账号 · 每页 {data.pageSize} 个 · 时间为澳门时间</p>
      {data.items.length === 0 ? <p className="py-6 text-sm text-muted">没有符合条件的账号。</p> :
        <div className="mt-3 overflow-x-auto rounded-xl border border-line" tabIndex={0} role="region" aria-label="用户列表，可横向滚动">
          <table className="w-full min-w-[580px] text-left text-sm">
            <thead className="bg-canvas text-muted"><tr><th scope="col" className="px-4 py-3 font-medium">邮箱 / 账号 ID</th><th scope="col" className="px-4 py-3 font-medium">角色</th><th scope="col" className="px-4 py-3 font-medium">注册时间</th></tr></thead>
            <tbody>{data.items.map(user => <tr key={user.id} className="border-t border-line">
              <td className="max-w-xs break-all px-4 py-3"><p className="font-medium text-ink">{user.email || '未绑定邮箱'}</p><p className="mt-1 text-xs text-muted">{user.id}</p></td>
              <td className="whitespace-nowrap px-4 py-3 text-ink">{user.role === 'admin' ? '管理员' : '普通用户'}</td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">{user.createdAt && Number.isFinite(Date.parse(user.createdAt)) ? dateFormat.format(new Date(user.createdAt)) : '时间未记录'}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      <nav aria-label="用户列表翻页" className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">第 {data.page} 页 / 共 {pages} 页</p>
        <div className="flex gap-2">
          {data.page > pages && <button type="button" className={buttonStyle} onClick={() => setQuery(current => ({...current, page: 1}))}>返回第一页</button>}
          <button type="button" className={buttonStyle} disabled={data.page <= 1} onClick={() => setQuery(current => ({...current, page: current.page - 1}))}>上一页</button>
          <button type="button" className={buttonStyle} disabled={data.page >= pages} onClick={() => setQuery(current => ({...current, page: current.page + 1}))}>下一页</button>
        </div>
      </nav>
    </>}
  </section>;
}
