import { apiFetch } from "@/lib/api-client";
import {
  messagePaths,
  type Announcement,
  type AnnouncementCreate,
  type Contacts,
  type ConversationOpen,
  type ConversationSummary,
  type ConversationView,
  type Message,
  type UnreadCounts,
} from "./contract";

/** Browser calls to the messaging API (src/app/api/me/…). Components use the hooks in ./hooks.ts. */
export const messagesApi = {
  conversations: (signal?: AbortSignal) => apiFetch<ConversationSummary[]>(messagePaths.conversations, { signal }),
  conversation: (id: string, before?: string, signal?: AbortSignal) => apiFetch<ConversationView>(messagePaths.conversation(id), { signal, searchParams: { before } }),
  open: (body: ConversationOpen) => apiFetch<{ id: string }>(messagePaths.conversations, { method: "POST", json: body }),
  send: (id: string, body: string) => apiFetch<Message>(messagePaths.messages(id), { method: "POST", json: { body } }),
  shareProgress: (id: string, note?: string) => apiFetch<Message>(messagePaths.progress(id), { method: "POST", json: note ? { note } : {} }),
  markRead: (id: string) => apiFetch<void>(messagePaths.read(id), { method: "POST" }),
  contacts: (signal?: AbortSignal) => apiFetch<Contacts>(messagePaths.contacts, { signal }),
  announcements: (signal?: AbortSignal) => apiFetch<Announcement[]>(messagePaths.announcements, { signal }),
  postAnnouncement: (body: AnnouncementCreate) => apiFetch<Announcement>(messagePaths.announcements, { method: "POST", json: body }),
  deleteAnnouncement: (id: string) => apiFetch<void>(messagePaths.announcement(id), { method: "DELETE" }),
  markAnnouncementRead: (id: string) => apiFetch<void>(messagePaths.announcementRead(id), { method: "POST" }),
  unread: (signal?: AbortSignal) => apiFetch<UnreadCounts>(messagePaths.unread, { signal }),
};

/** Where the live event stream is (EventSource connects to it directly). */
export const EVENTS_URL = `/api${messagePaths.events}`;
