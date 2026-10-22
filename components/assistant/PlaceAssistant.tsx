"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import {
  ArrowUp,
  ArrowUpRight,
  Check,
  Compass,
  History,
  Minimize2,
  MapPin,
  Plus,
  Route,
  Square,
  Utensils,
  X,
} from "lucide-react";
import { chatCopy } from "@/lib/assistant/chat-copy";
import { usePlaceChat } from "./usePlaceChat";
import ConversationHistory from "./ConversationHistory";
import ChatOriginPicker from "./ChatOriginPicker";
import RouteComparisonTable from "./RouteComparisonTable";
import AssistantAnswer from "./AssistantAnswer";

export default function PlaceAssistant({
  visible = true,
  onMinimize,
}: {
  visible?: boolean;
  onMinimize: () => void;
}) {
  const locale = useLocale();
  const copy = useMemo(() => chatCopy(locale), [locale]);
  const chat = usePlaceChat(copy);
  const [showHistory, setShowHistory] = useState(false);
  const [showOrigin, setShowOrigin] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null),
    inputRef = useRef<HTMLTextAreaElement>(null);
  const empty = chat.messages.length === 0;
  const unresolved = chat.pending?.groups.find((group) => !group.selected);
  useEffect(() => {
    if (visible && !showHistory)
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
  }, [chat.messages, chat.pending, visible, showHistory]);
  useEffect(() => {
    if (visible && !showHistory) inputRef.current?.focus({ preventScroll: true });
  }, [visible, showHistory]);
  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = "auto";
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 168)}px`;
  }, [chat.draft, showHistory]);
  const example = (text: string) => {
    chat.setDraft(text);
    inputRef.current?.focus();
  };
  const reset = () => {
    chat.reset();
    setShowHistory(false);
    setShowOrigin(false);
    inputRef.current?.focus();
  };
  return (
    <div className="flex h-full min-h-0 bg-canvas text-ink">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-line/70 px-4 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-pine-700 text-white">
              <Compass size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">
                {copy.title}
              </h2>
              <p className="truncate text-xs text-muted">
                {copy.helper}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                chat.saveConversation();
                setShowHistory(previous => !previous);
                setShowOrigin(false);
              }}
              aria-label={copy.historyTitle}
              title={copy.historyTitle}
              aria-pressed={showHistory}
              className={`flex h-10 w-10 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-700 ${showHistory ? "bg-pine-100 text-pine-800" : "text-muted hover:bg-pine-50"}`}
            >
              <History size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={reset}
              aria-label={copy.newChat}
              title={copy.newChat}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-stone-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              <Plus size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onMinimize}
              aria-label={copy.minimize}
              title={copy.minimize}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-stone-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              <Minimize2 size={17} aria-hidden="true" />
            </button>
          </div>
        </header>
        {chat.historyUnavailable && (
          <p role="status" className="shrink-0 border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-900">
            {copy.historyUnavailable}
          </p>
        )}
        {showHistory ? (
          <ConversationHistory
            items={chat.conversations}
            activeId={chat.conversationId}
            copy={copy}
            onSelect={id => {
              if (chat.selectConversation(id)) {
                setShowHistory(false);
                setShowOrigin(false);
              }
            }}
            onDelete={chat.deleteConversation}
            onNew={reset}
          />
        ) : <>
          {chat.viewingHistory && <p className="shrink-0 border-b border-line bg-pine-50 px-4 py-2 text-xs leading-5 text-pine-800">{copy.historyNotice}</p>}
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            {empty ? (
              <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-5 pb-5 pt-5">
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-pine-700 text-white shadow-[0_6px_18px_rgba(6,78,59,0.12)]">
                  <Compass size={28} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <p className="mb-3 text-[11px] font-medium tracking-[.2em] text-pine-700">
                  CHENGMI AI
                </p>
                <h3 className="text-2xl font-semibold tracking-tight text-stone-900">
                  {copy.welcome}
                </h3>
                <p className="mt-3 max-w-lg text-xs leading-6 text-muted">
                  {copy.welcomeHint}
                </p>
                <div className="mt-5 grid gap-2">
                  {[
                    {
                      title: copy.exampleTravelTitle,
                      text: copy.exampleTravel,
                      icon: Route,
                    },
                    {
                      title: copy.exampleFoodTitle,
                      text: copy.exampleFood,
                      icon: Utensils,
                    },
                  ].map(({ title, text, icon: Icon }) => (
                    <button
                      type="button"
                      key={title}
                      onClick={() => example(text)}
                      className="group rounded-2xl border border-line bg-white/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-800/30 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800"
                    >
                      <span className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
                        <Icon
                          size={16}
                          className="text-pine-700"
                          aria-hidden="true"
                        />
                        {title}
                        <ArrowUpRight
                          size={14}
                          className="ml-auto text-muted group-hover:text-pine-700"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="line-clamp-2 text-xs leading-6 text-muted">
                        {text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <section
                aria-label={copy.session}
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
                className="mx-auto w-full max-w-4xl space-y-6 px-4 py-5"
              >
                {chat.messages.map((message, index) =>
                  message.role === "user" ? (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-[22px] rounded-br-md bg-[#eaeae3] px-5 py-3.5 text-sm leading-7 text-ink">
                        {message.text}
                      </div>
                    </div>
                  ) : (
                    <div key={message.id} className="flex gap-3 sm:gap-4">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-pine-700 text-white">
                        <Compass size={19} strokeWidth={1.6} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="mb-2 text-xs font-semibold text-stone-700">
                          {copy.title}
                        </p>
                        {message.historical && <p className="mb-1 text-xs text-muted">{copy.historyAnswer}</p>}
                        <AssistantAnswer message={message} copy={copy} />
                        {message.error && (
                          <button
                            type="button"
                            disabled={chat.busy}
                            onClick={() =>
                              void chat.send(chat.messages[index - 1]?.text)
                            }
                            className="mt-2 min-h-10 text-xs font-medium text-pine-700 underline"
                          >
                            {copy.retry}
                          </button>
                        )}
                        {chat.pending?.messageId === message.id && (
                          <>
                            {unresolved ? (
                              <div className="mt-4 space-y-2">
                                {unresolved.options.map((place) => (
                                  <button
                                    type="button"
                                    disabled={chat.busy}
                                    key={place.id}
                                    onClick={() => chat.choosePlace(place)}
                                    className="flex min-h-12 w-full items-start gap-3 rounded-xl border border-line bg-white px-4 py-3 text-left transition hover:border-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                  >
                                    <MapPin
                                      size={16}
                                      className="mt-1 shrink-0 text-pine-700"
                                      aria-hidden="true"
                                    />
                                    <span>
                                      <span className="block text-sm font-medium">
                                        {place.name}
                                      </span>
                                      <span className="mt-1 block text-xs leading-5 text-muted">
                                        {place.address || copy.addressUnknown}
                                      </span>
                                      {place.source === "amap" && (
                                        <span className="mt-1 block text-xs text-muted">
                                          {copy.mapPlace}
                                        </span>
                                      )}
                                    </span>
                                    <Check
                                      size={15}
                                      className="ml-auto mt-1 shrink-0 text-stone-300"
                                      aria-hidden="true"
                                    />
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <ChatOriginPicker
                                copy={copy}
                                options={chat.pending.originOptions}
                                busy={chat.busy}
                                onSelect={chat.chooseOrigin}
                                onLocate={() => void chat.locate()}
                              />
                            )}
                          </>
                        )}
                        {message.places && message.origin && (
                          <RouteComparisonTable
                            places={message.places}
                            routes={message.routes ?? []}
                            origin={message.origin}
                            copy={copy}
                          />
                        )}
                      </div>
                    </div>
                  ),
                )}
              </section>
            )}
          </div>
          <div className="z-10 mx-auto w-full max-w-4xl shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
            {showOrigin && (
              <div className="mb-3 max-h-[45dvh] overflow-y-auto rounded-2xl border border-line bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{copy.originQuestion}</p>
                  <button
                    type="button"
                    aria-label={copy.close}
                    onClick={() => setShowOrigin(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-stone-100"
                  >
                    <X size={16} />
                  </button>
                </div>
                <ChatOriginPicker
                  copy={copy}
                  busy={chat.busy}
                  onSelect={(poi) => {
                    chat.chooseOrigin(poi);
                    setShowOrigin(false);
                  }}
                  onLocate={() => void chat.locate()}
                />
              </div>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void chat.send();
              }}
              className="rounded-[24px] border border-stone-300/80 bg-white p-3 shadow-[0_4px_24px_rgba(28,25,23,0.04)] focus-within:border-emerald-800/40 focus-within:shadow-[0_4px_24px_rgba(6,78,59,0.06)] sm:p-4"
            >
              <textarea
                ref={inputRef}
                aria-label={copy.inputLabel}
                placeholder={copy.messagePlaceholder}
                value={chat.draft}
                onChange={(event) => chat.setDraft(event.target.value)}
                maxLength={1200}
                rows={2}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    void chat.send();
                  }
                }}
                className="max-h-44 min-h-14 w-full resize-none bg-transparent px-1 text-base leading-7 text-ink placeholder:text-muted focus:outline-none"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={chat.busy}
                  onClick={() => setShowOrigin((value) => !value)}
                  className="inline-flex min-h-9 max-w-[75%] items-center gap-1.5 rounded-full border border-line px-3 text-xs text-muted hover:border-emerald-700 hover:text-pine-800 disabled:opacity-50"
                >
                  <MapPin size={13} className="shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {chat.origin
                      ? `${copy.originFrom} ${chat.origin.label}`
                      : copy.originButton}
                  </span>
                </button>
                {chat.busy ? (
                  <button
                    type="button"
                    onClick={chat.stop}
                    aria-label={copy.stop}
                    title={copy.stop}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-800 text-white hover:bg-stone-700"
                  >
                    <Square size={14} fill="currentColor" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!chat.draft.trim()}
                    aria-label={copy.sendLabel}
                    title={copy.sendLabel}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pine-700 text-white transition hover:bg-pine-800 disabled:bg-stone-200 disabled:text-muted"
                  >
                    <ArrowUp size={19} aria-hidden="true" />
                  </button>
                )}
              </div>
            </form>
            <div className="mt-2 flex justify-center gap-3 text-center text-xs leading-relaxed text-muted">
              <span>{copy.footer}</span>
            </div>
          </div>
        </>}
      </div>
    </div>
  );
}
