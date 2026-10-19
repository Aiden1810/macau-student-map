import { z } from 'zod';
import { coordinatesSchema, type AssistantPlace } from './contracts';
import type { ChatCopy } from './chat-copy';
import type { ChatMessage } from '../../components/assistant/chat-types';
import { formatRouteDistance } from './format-distance';

export const HISTORY_STORAGE_KEY = 'chengmi-assistant-history-v1';
const MAX_CONVERSATIONS = 20;
const MAX_MESSAGES = 80;
const MAX_STORAGE_CHARS = 600_000;
const text = (max: number) => z.string().max(max);
const timestamp = z.number().int().min(0).max(8_640_000_000_000_000);
const savedMessageSchema = z.object({
  id: text(120).min(1), role: z.enum(['user', 'assistant']), text: text(16000),
  status: z.enum(['done', 'error', 'interrupted', 'confirmation']),
}).refine(message => message.role !== 'user' || message.text.length <= 1200);
const savedPlaceSchema = z.object({
  id: text(200).min(1), name: text(300), address: text(600),
  coordinates: coordinatesSchema.nullable(),
  source: z.enum(['catalog', 'amap']).optional(), catalogId: text(200).optional(),
  city: z.enum(['澳门', '珠海']).nullable().optional(),
});
const savedConversationSchema = z.object({
  id: text(120).min(1), createdAt: timestamp, updatedAt: timestamp,
  messages: z.array(savedMessageSchema).max(MAX_MESSAGES),
  draft: text(1200), places: z.array(savedPlaceSchema).max(4),
});
const archiveSchema = z.object({
  version: z.literal(1), activeId: text(120).nullable(),
  conversations: z.array(savedConversationSchema).max(MAX_CONVERSATIONS),
}).refine(archive => new Set(archive.conversations.map(item => item.id)).size === archive.conversations.length);

export type SavedConversation = z.infer<typeof savedConversationSchema>;
export type ConversationArchive = z.infer<typeof archiveSchema>;
export const emptyArchive = (): ConversationArchive => ({ version: 1, activeId: null, conversations: [] });

export function parseArchive(raw: string | null): ConversationArchive | null {
  if (raw === null) return emptyArchive();
  if (raw.length > MAX_STORAGE_CHARS) return null;
  try {
    const parsed = archiveSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const archive = parsed.data;
    if (!archive.conversations.some(item => item.id === archive.activeId)) archive.activeId = null;
    return archive;
  } catch { return null; }
}

export function readArchive(storage: Pick<Storage, 'getItem'>) {
  try {
    const archive = parseArchive(storage.getItem(HISTORY_STORAGE_KEY));
    return { archive: archive ?? emptyArchive(), available: archive !== null };
  } catch { return { archive: emptyArchive(), available: false }; }
}

export function conversationTitle(conversation: SavedConversation, fallback: string): string {
  const title = conversation.messages.find(message => message.role === 'user')?.text || conversation.draft || fallback;
  return title.replace(/\s+/g, ' ').trim().slice(0, 36);
}

export function upsertConversation(archive: ConversationArchive, conversation: SavedConversation): ConversationArchive {
  if (!conversation.messages.length && !conversation.draft.trim()) {
    return removeConversation(archive, conversation.id);
  }
  const conversations = [conversation, ...archive.conversations.filter(item => item.id !== conversation.id)]
    .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS);
  return { version: 1, activeId: conversation.id, conversations };
}

export function removeConversation(archive: ConversationArchive, id: string): ConversationArchive {
  return {    
...archive, activeId: archive.activeId === id ? null : archive.activeId,
    conversations: archive.conversations.filter(item => item.id !== id)  
};
}

/** Retry quota failures with older sessions removed; never drop the active one. */
export function writeArchive(storage: Pick<Storage, 'setItem'>, archive: ConversationArchive) {
  let candidate = archive;
  while (true) {
    const serialized = JSON.stringify(candidate);
    if (serialized.length <= MAX_STORAGE_CHARS) {
      try {
        storage.setItem(HISTORY_STORAGE_KEY, serialized);
        return { ok: true, archive: candidate };
      } catch { /* A small archive may still fit after evicting an old session. */ }
    }
    const oldest = [...candidate.conversations].reverse().find(item => item.id !== candidate.activeId);
    if (!oldest) return { ok: false, archive };
    candidate = removeConversation(candidate, oldest.id);
  }
}

function routeTranscript(message: ChatMessage, copy: ChatCopy): string {
  if (!message.places?.length || !message.routes?.length) return '';
  const lines: string[] = [];
  for (const place of message.places) {
    const route = message.routes.find(item => item.placeId === place.id);
    if (!route) continue;
    lines.push(place.name, `${copy.updated} ${new Date(route.queriedAt).toLocaleString(copy.locale)}`);
    for (const mode of ['taxi', 'transit', 'walking'] as const) {
      const choice = route[mode];
      if (!choice) { lines.push(`${copy[mode]}：${copy.notQueried}`); continue; }
      if (choice.status !== 'ok') { lines.push(`${copy[mode]}：${copy[choice.status]}`); continue; }
      lines.push(`${copy[mode]}：${Math.ceil(choice.durationSeconds / 60)} ${copy.minutes} · ${formatRouteDistance(choice.distanceMeters, copy)}`);
      if (choice.lines.length) lines.push(choice.lines.join(' → '));
      if (choice.walkingMeters !== null) lines.push(`${copy.walk} ${formatRouteDistance(choice.walkingMeters, copy)}`);
    }
  }
  return lines.join('\n');
}

export function snapshotConversation(input: {
  id: string; createdAt: number; messages: ChatMessage[]; draft: string;
  places: AssistantPlace[]; pendingId: string | null;
}, copy: ChatCopy, now = Date.now()): SavedConversation {
  return {
    id: input.id, createdAt: input.createdAt, updatedAt: now, draft: input.draft.slice(0, 1200),
    messages: input.messages.slice(-MAX_MESSAGES).map(message => ({
      id: message.id, role: message.role,
      text: [message.text, routeTranscript(message, copy)].filter(Boolean).join('\n\n').slice(0, message.role === 'user' ? 1200 : 16000),
      status: message.loading ? 'interrupted' : message.id === input.pendingId ? 'confirmation' : message.error ? 'error' : 'done',
    })),
    // Only public branch identity is stored; prices/tags are refreshed by the chat API.
    places: input.places.slice(0, 4).map(({ id, name, address, coordinates, source, catalogId, city }) => ({ id, name, address, coordinates, source, catalogId, city })),
  };
}

export function restoreConversation(conversation: SavedConversation, copy: ChatCopy) {
  const messages: ChatMessage[] = conversation.messages.map(message => ({
    id: message.id, role: message.role, loading: false,
    text: message.status === 'interrupted' ? copy.historyInterrupted
      : message.status === 'confirmation' ? `${message.text}\n\n${copy.historyConfirmation}` : message.text,
    error: message.status === 'error', historical: true,
  }));
  const places: AssistantPlace[] = conversation.places.map(place => ({ ...place, category: 'unknown', pricePerPerson: null, tags: [] }));
  return { messages, places, questions: messages.filter(message => message.role === 'user').slice(-6).map(message => message.text) };
}
