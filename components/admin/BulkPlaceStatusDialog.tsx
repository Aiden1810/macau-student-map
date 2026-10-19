'use client';

import {useEffect, useId, useRef} from 'react';
import type {AdminPlaceRecord} from '@/lib/admin/place-editor';
import type {BulkPlaceStatus} from '@/lib/admin/bulk-place-selection';

export default function BulkPlaceStatusDialog({status, items, busy, onCancel, onConfirm}: {
  status: BulkPlaceStatus; items: Pick<AdminPlaceRecord, 'id' | 'name' | 'status'>[];
  busy: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const action = status === 'published' ? '上线' : '下线';
  const unchanged = items.filter(item => item.status === status).length;
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => {event.preventDefault(); if (!busy) onCancel();}}
    className="w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-white p-5 text-ink shadow-xl backdrop:bg-slate-950/40">
    <h3 id={titleId} className="text-lg font-bold">确认{action} {items.length} 家店铺</h3>
    <p id={descriptionId} className="mt-2 text-sm leading-6 text-muted">{status === 'published'
      ? '上线后用户可以在地图和列表看到这些店铺；资料不符合发布要求的店铺会单独提示。'
      : '下线后用户端将隐藏这些店铺，店铺资料和图片会保留，后续可以重新上线。'}</p>
    <ul className="my-4 max-h-48 space-y-2 overflow-y-auto rounded-xl bg-canvas p-3 text-sm">
      {items.map(item => <li key={item.id} className="break-words">{item.name}</li>)}
    </ul>
    {unchanged > 0 && <p className="text-xs text-muted">其中 {unchanged} 家已经是目标状态，会跳过重复修改。</p>}
    <p className="mt-3 text-xs text-muted">只处理本次勾选的店铺；每家单独执行，结果会分别显示。</p>
    <div className="mt-5 flex justify-end gap-3">
      <button type="button" autoFocus disabled={busy} onClick={onCancel} className="min-h-11 rounded-xl border border-line px-4 text-sm disabled:opacity-50">取消</button>
      <button type="button" disabled={busy || items.length === 0} aria-busy={busy} onClick={onConfirm}
        className="min-h-11 rounded-xl bg-pine-700 px-4 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? '正在处理，请稍候…' : `确认${action}`}
      </button>
    </div>
  </dialog>;
}
