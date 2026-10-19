"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  chatUnderstandingSchema,
  chooseKnownChatPlace,
  resolveChatOrigin,
  type ChatPlan,
} from "@/lib/assistant/chat";
import type {
  AssistantOrigin,
  AssistantPlace,
  RouteSnapshot,
} from "@/lib/assistant/contracts";
import { comparePlaces } from "@/lib/assistant/decision";
import { formatAssistantAnswer } from "@/lib/assistant/answer";
import {
  compareAmapRoutes,
  resolveRouteCity,
} from "@/lib/amap/route-comparison";
import { locateAssistantOrigin } from "@/lib/amap/assistant-location";
import { searchChatMap, mapChatPlace } from "@/lib/amap/chat-search";
import type { AmapPoiOption } from "@/lib/amap/place-search";
import type { ChatCopy } from "@/lib/assistant/chat-copy";
import type { ChatMessage, PendingChat, PlaceConfirmation } from "./chat-types";
import {
  emptyArchive, readArchive, writeArchive, snapshotConversation,
  restoreConversation, upsertConversation, removeConversation,
  type ConversationArchive, type SavedConversation,
} from "@/lib/assistant/conversation-history";

export function usePlaceChat(copy: ChatCopy) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState<AssistantOrigin | null>(null);
  const [pending, setPending] = useState<PendingChat | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const serial = useRef(0),
    active = useRef<AbortController | null>(null),
    working = useRef(false);
  const history = useRef<string[]>([]),
    contextPlaces = useRef<AssistantPlace[]>([]);
  const mapKey = process.env.NEXT_PUBLIC_AMAP_WEB_KEY || "";
  const dispose = useCallback(() => {
    serial.current++;
    active.current?.abort();
    working.current = false;
  }, []);

  const [conversations, setConversations] = useState<ConversationArchive>(emptyArchive);
  const [conversationId, setConversationId] = useState("");
  const [historyReady, setHistoryReady] = useState(false);
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  const [viewingHistory, setViewingHistory] = useState(false);
  const archiveRef = useRef<ConversationArchive>(emptyArchive());
  const storageRef = useRef<Storage | null>(null);
  const createdAtRef = useRef(0);
  const hydratedRef = useRef(false);
  const aliveRef = useRef(true);
  const saveCurrentRef = useRef<() => void>(() => { });

  const publishArchive = useCallback((next: ConversationArchive) => {
    const result = storageRef.current ? writeArchive(storageRef.current, next) : { ok: false, archive: next };
    archiveRef.current = result.archive;
    if (aliveRef.current) {
      setConversations(result.archive);
      setHistoryUnavailable(!result.ok);
    }
  }, []);

  const applyConversation = useCallback((saved: SavedConversation) => {
    dispose();
    const restored = restoreConversation(saved, copy);
    history.current = restored.questions;
    contextPlaces.current = restored.places;
    createdAtRef.current = saved.createdAt;
    setConversationId(saved.id);
    setMessages(restored.messages);
    setDraft(saved.draft);
    setBusy(false);
    setPending(null);
    setOrigin(null);
    setViewingHistory(true);
  }, [copy, dispose]);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    let loaded = { archive: emptyArchive(), available: false };
    try {
      loaded = readArchive(window.localStorage);
      if (loaded.available) storageRef.current = window.localStorage;
    } catch { /* Chat still works when browser storage is denied. */ }
    archiveRef.current = loaded.archive;
    setConversations(loaded.archive);
    setHistoryUnavailable(!loaded.available);
    const saved = loaded.archive.conversations.find(item => item.id === loaded.archive.activeId);
    if (saved) applyConversation(saved);
    else { setConversationId(crypto.randomUUID()); createdAtRef.current = Date.now(); }
    setHistoryReady(true);
  }, [applyConversation]);

  const persistCurrent = useCallback(() => {
    if (!historyReady || !conversationId) return;
    const snapshot = snapshotConversation({
      id: conversationId, createdAt: createdAtRef.current,
      messages, draft, places: contextPlaces.current, pendingId: pending?.messageId ?? null,
    }, copy);
    publishArchive(upsertConversation(archiveRef.current, snapshot));
  }, [historyReady, conversationId, messages, draft, pending, copy, publishArchive]);

  useEffect(() => {
    saveCurrentRef.current = persistCurrent;
    if (!historyReady) return;
    const timer = setTimeout(persistCurrent, 250);
    return () => clearTimeout(timer);
  }, [persistCurrent, historyReady]);

  useEffect(() => {
    aliveRef.current = true;
    const flush = () => saveCurrentRef.current();
    window.addEventListener("pagehide", flush);
    return () => {
      aliveRef.current = false;
      flush();
      window.removeEventListener("pagehide", flush);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/assistant", { signal: controller.signal })
      .then((r) => r.json())
      .then((body) => {
        if (!controller.signal.aborted)
          setAvailable(Boolean(body.data?.available));
      })
      .catch(() => { });
    return () => {
      controller.abort();
      dispose();
    };
  }, [dispose]);
  const update = (id: string, patch: Partial<ChatMessage>) =>
    setMessages((previous) =>
      previous.map((message) =>
        message.id === id ? { ...message, ...patch } : message,
      ),
    );
  const finishWork = (token: number) => {
    if (token === serial.current) {
      working.current = false;
      setBusy(false);
    }
  };

  async function advance(task: PendingChat) {
    if (task.token !== serial.current) return;
    const unresolved = task.groups.find((group) => !group.selected);
    const places = [
      ...new Map(
        task.groups
          .flatMap((group) => (group.selected ? [group.selected] : []))
          .map((place) => [place.id, place]),
      ).values(),
    ];
    contextPlaces.current = places;
    if (unresolved) {
      setPending(task);
      update(task.messageId, {
        text: `${unresolved.options.length ? copy.confirmPlace : copy.notFound}\n${unresolved.query}`,
        loading: false,
      });
      finishWork(task.token);
      return;
    }
    if (!places.length) {
      update(task.messageId, { text: copy.askNames, loading: false });
      setPending(null);
      finishWork(task.token);
      return;
    }
    if (
      !task.origin &&
      (task.intent.intent === "travel_times" ||
        task.intent.priority === "fastest" ||
        task.originQuery !== null)
    ) {
      setPending(task);
      update(task.messageId, {
        text: task.originOptions.length
          ? `${copy.originConfirm}\n${task.originQuery ?? ""}`
          : copy.originQuestion,
        loading: false,
      });
      finishWork(task.token);
      return;
    }
    setPending(null);
    update(task.messageId, { text: copy.routing, loading: true });
    let routes: RouteSnapshot[] = [];
    let mapFailed = false;
    if (task.origin) {
      try {
        routes = await compareAmapRoutes(
          mapKey,
          task.origin,
          places.map((place) => ({
            id: place.id,
            coordinates: place.coordinates,
            city: place.city ?? resolveRouteCity(place),
          })),
        );
      } catch {
        mapFailed = true;
      }
    }
    if (task.token !== serial.current) return;
    const text =
      task.intent.intent === "travel_times"
        ? `${task.origin ? `${copy.originFrom}「${task.origin.label}」\n` : ""}${mapFailed ? copy.routesFailed : copy.routeIntro}`
        : formatAssistantAnswer(
          comparePlaces(places, task.intent, routes),
          task.intent,
          copy,
          Boolean(task.origin),
        );
    update(task.messageId, {
      text,
      loading: false,
      places: task.origin ? places : undefined,
      routes,
      origin: task.origin,
    });
    finishWork(task.token);
  }

  async function send(question = draft) {
    const text = question.trim();
    if (!historyReady || !text || text.length > 1200 || working.current) return;
    const token = ++serial.current;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    working.current = true;
    setBusy(true);
    setPending(null);
    const id = crypto.randomUUID();
    setMessages((previous) => [
      ...previous,
      { id: crypto.randomUUID(), role: "user", text },
      { id, role: "assistant", text: copy.typing, loading: true },
    ]);
    setDraft("");
    history.current = [...history.current, text].slice(-6);
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: history.current,
          locale: copy.locale,
          context: {
            places: contextPlaces.current.map(({ name, address }) => ({
              name,
              address,
            })),
            originLabel: origin?.label ?? null,
          },
        }),
      });
      const body = await response.json();
      if (token !== serial.current) return;
      if (!response.ok || !body.ok)
        throw Error(response.status === 429 ? "rate" : "request");
      if (body.data.mode === "unconfigured") {
        setAvailable(false);
        update(id, { text: copy.unconfigured, loading: false });
        finishWork(token);
        return;
      }
      setAvailable(true);
      const plan = body.data as ChatPlan;
      const understanding = chatUnderstandingSchema.parse(plan.understanding);
      if (understanding.intent.intent === "clarify") {
        update(id, { text: copy.helpReply, loading: false });
        finishWork(token);
        return;
      }
      if (!plan.groups.length) {
        update(id, { text: copy.askNames, loading: false });
        finishWork(token);
        return;
      }
      update(id, { text: copy.finding });
      const groups: PlaceConfirmation[] = [];
      for (const group of plan.groups) {
        const known = chooseKnownChatPlace(
          group,
          contextPlaces.current,
          understanding.intent.intent === "travel_times" ||
          understanding.intent.priority === "fastest",
        );
        if (known) {
          groups.push({
            query: group.query,
            options: [known],
            selected: known,
          });
          continue;
        }
        if (group.candidates.length) {
          const unique =
            group.candidates.length === 1 ? group.candidates[0] : null;
          if (!unique || unique.coordinates) {
            groups.push({
              query: group.query,
              options: group.candidates,
              selected: unique,
            });
            continue;
          }
        }
        const options = await searchChatMap(
          mapKey,
          group.query,
          copy.unnamed,
        ).then((pois) =>
          pois.map((poi) =>
            mapChatPlace(
              poi,
              group.candidates.length === 1 ? group.candidates[0] : undefined,
            ),
          ),
        );
        if (token !== serial.current) return;
        groups.push({ query: group.query, options, selected: null });
      }
      const originRequest = resolveChatOrigin(
        understanding.originAction,
        understanding.originQuery,
        origin,
      );
      const nextOrigin = originRequest.origin;
      let originOptions: AmapPoiOption[] = [];
      const originQuery = originRequest.query;
      if (
        understanding.originAction === "search" &&
        understanding.originQuery
      ) {
        originOptions = await searchChatMap(
          mapKey,
          understanding.originQuery,
          copy.unnamed,
        );
      }
      if (token !== serial.current) return;
      if (!nextOrigin) setOrigin(null);
      await advance({
        messageId: id,
        token,
        intent: understanding.intent,
        groups,
        origin: nextOrigin,
        originOptions,
        originQuery,
      });
    } catch (error) {
      if (token !== serial.current || controller.signal.aborted) return;
      update(id, {
        text:
          error instanceof Error && error.message === "rate"
            ? copy.rateLimit
            : copy.requestError,
        loading: false,
        error: true,
      });
      finishWork(token);
    }
  }
  async function choosePlace(place: AssistantPlace) {
    if (!pending || working.current) return;
    const index = pending.groups.findIndex((group) => !group.selected);
    if (
      index < 0 ||
      !pending.groups[index].options.some((option) => option.id === place.id)
    )
      return;
    working.current = true;
    setBusy(true);
    if (
      !place.coordinates &&
      (pending.intent.intent === "travel_times" ||
        pending.intent.priority === "fastest")
    ) {
      try {
        const options = await searchChatMap(
          mapKey,
          place.name,
          copy.unnamed,
        ).then((pois) => pois.map((poi) => mapChatPlace(poi, place)));
        if (pending.token !== serial.current) return;
        await advance({
          ...pending,
          groups: pending.groups.map((group, i) =>
            i === index ? { ...group, options, selected: null } : group,
          ),
        });
      } catch {
        if (pending.token === serial.current) {
          update(pending.messageId, { text: copy.poiFailed, loading: false });
          finishWork(pending.token);
        }
      }
      return;
    }
    const groups = pending.groups.map((group, i) =>
      i === index ? { ...group, selected: place } : group,
    );
    void advance({ ...pending, groups });
  }
  function chooseOrigin(poi: AmapPoiOption) {
    if (working.current || poi.city === "unknown") return;
    const next: AssistantOrigin = {
      label: poi.name,
      coordinates: poi.coordinates,
      city: poi.city === "zhuhai" ? "珠海" : "澳门",
    };
    setOrigin(next);
    if (pending) {
      working.current = true;
      setBusy(true);
      void advance({
        ...pending,
        origin: next,
        originOptions: [],
        originQuery: null,
      });
    }
  }
  async function locate() {
    if (working.current) return;
    const token = serial.current;
    working.current = true;
    setBusy(true);
    try {
      const next = await locateAssistantOrigin(mapKey, copy.currentLocation);
      if (token !== serial.current) return;
      setOrigin(next);
      if (pending)
        await advance({
          ...pending,
          origin: next,
          originOptions: [],
          originQuery: null,
        });
    } catch {
      if (token === serial.current) {
        if (pending)
          update(pending.messageId, {
            text: copy.locationError,
            loading: false,
          });
        else
          setMessages((previous) => [
            ...previous,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              text: copy.locationError,
            },
          ]);
      }
    } finally {
      finishWork(token);
    }
  }
  function stop() {
    serial.current++;
    active.current?.abort();
    working.current = false;
    setBusy(false);
    setPending(null);
    setMessages((previous) =>
      previous.map((message) =>
        message.loading
          ? { ...message, loading: false, text: copy.stopped }
          : message,
      ),
    );
  }
  function reset() {
    persistCurrent();
    dispose();
    setBusy(false);
    setPending(null);
    setMessages([]);
    setDraft("");
    history.current = [];
    contextPlaces.current = [];
    setOrigin(null);
    createdAtRef.current = Date.now();
    setConversationId(crypto.randomUUID());
    setViewingHistory(false);
    publishArchive({ ...archiveRef.current, activeId: null });
  }
  function selectConversation(id: string) {
    persistCurrent();
    const saved = archiveRef.current.conversations.find(item => item.id === id);
    if (!saved) return false;
    applyConversation(saved);
    publishArchive({ ...archiveRef.current, activeId: id });
    return true;
  }
  function deleteConversation(id: string) {
    if (id === conversationId) {
      dispose();
      setBusy(false);
      setPending(null);
      setMessages([]);
      setDraft("");
      setOrigin(null);
      history.current = [];
      contextPlaces.current = [];
      createdAtRef.current = Date.now();
      setConversationId(crypto.randomUUID());
      setViewingHistory(false);
    }
    publishArchive(removeConversation(archiveRef.current, id));
  }
  return {
    messages,
    draft,
    setDraft,
    busy,
    origin,
    pending,
    available,
    send,
    choosePlace,
    chooseOrigin,
    locate,
    stop,
    reset,
    conversations: conversations.conversations,
    conversationId,
    historyReady,
    historyUnavailable,
    viewingHistory,
    selectConversation,
    deleteConversation,
    saveConversation: persistCurrent,
  };
}
