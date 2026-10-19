"use client";

import { ArrowRight, MessageSquare, Plus, Trash2 } from "lucide-react";
import {
  conversationTitle,
  type SavedConversation,
} from "@/lib/assistant/conversation-history";
import type { ChatCopy } from "@/lib/assistant/chat-copy";

export default function ConversationHistory({
  items, activeId, copy, onSelect, onDelete, onNew,
}: {
  items: SavedConversation[];
  activeId: string;
  copy: ChatCopy;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <section aria-label={copy.historyTitle} className="flex min-h-0 flex-1 flex-col px-4 py-5">
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-ink">{copy.historyTitle}</h3>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-pine-700 px-3 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-pine-600 focus-visible:ring-offset-2"
        >
          <Plus size={16} aria-hidden="true" />
          {copy.newChat}
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pb-3">
        {!items.length && (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 text-center text-muted">
            <MessageSquare size={30} strokeWidth={1.4} aria-hidden="true" />
            <p className="text-sm">{copy.historyEmpty}</p>
          </div>
        )}
        {items.map(item => {
          const title = conversationTitle(item, copy.newChat);
          return (
            <article
              key={item.id}
              className={`flex items-center gap-1 rounded-2xl border p-1 ${item.id === activeId ? "border-pine-200 bg-pine-50" : "border-line bg-white"}`}
            >
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={item.id === activeId ? "true" : undefined}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-700"
              >
                <MessageSquare size={18} aria-hidden="true" className="shrink-0 text-pine-700" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{title}</span>
                  <span className="mt-1 block text-xs text-muted">
                    {new Date(item.updatedAt).toLocaleString(copy.locale, {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                    {item.draft.trim() ? ` · ${copy.historyDraft}` : ""}
                  </span>
                </span>
                <ArrowRight size={15} aria-hidden="true" className="shrink-0 text-muted" />
              </button>
              <button
                type="button"
                aria-label={`${copy.deleteChat}: ${title}`}
                onClick={() => onDelete(item.id)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-pine-700"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </article>
          );
        })}
      </div>
      <p className="mt-3 shrink-0 border-t border-line pt-3 text-xs leading-5 text-muted">
        {copy.historyLocal}
      </p>
    </section>
  );
}
