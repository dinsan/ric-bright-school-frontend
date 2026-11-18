/**
 * Communication between parents and teachers (FE-PAR-04, FE-COM-02): conversations about a child,
 * progress updates, class announcements, unread counts and the live event stream. JSON shapes and paths
 * shared by the browser and the server (src/server/messages). Keep it free of server-only and client-only code.
 *
 * Who may talk: a child's parents and guardians, and the verified teachers of the child's classes. A
 * conversation is about one child and shared by the teacher and all the child's guardians. Children
 * never see messages.
 */

export const MESSAGE_MAX_LENGTH = 2000;
export const ANNOUNCEMENT_TITLE_MAX = 120;
export const ANNOUNCEMENT_BODY_MAX = 4000;

export interface Person {
  id: string;
  name: string;
  /** "Teacher", "Leo's parent". */
  role_label: string;
}

/** A snapshot shared in a conversation (a message of kind "progress"). Frozen: it reads the same later. */
export interface ProgressSnapshot {
  /** "Work in Class 5L" (a teacher's) or "Learning at home" (a parent's). */
  title: string;
  /** When the numbers were taken. */
  as_of: string;
  items: Array<{ label: string; value: string; tone?: "good" | "attention" | "neutral" }>;
}

export interface Message {
  id: string;
  conversation_id: string;
  kind: "text" | "progress";
  /** The text (for a progress update: the note written with it, may be empty). */
  body: string;
  snapshot: ProgressSnapshot | null;
  /** Null when the sender's account was deleted. */
  sender: Person | null;
  /** Sent by the person reading. */
  mine: boolean;
  created_at: string;
}

/** A conversation in the inbox. GET /me/conversations. */
export interface ConversationSummary {
  id: string;
  child: { id: string; name: string; grade_level: number | null };
  teacher: { id: string; name: string };
  /** The child's classes with this teacher. */
  classes: string[];
  last_message: { preview: string; at: string; sender_name: string | null; mine: boolean } | null;
  unread: number;
}

/** One conversation with its latest messages (oldest first). GET /me/conversations/{id}?before=… */
export interface ConversationView extends ConversationSummary {
  /** Everyone in it: the teacher and the child's parents and guardians. */
  participants: Person[];
  messages: Message[];
  /** There are older messages (load them with ?before=<oldest created_at>). */
  has_more: boolean;
  /** What the teacher and parents can see about the child here: the child's work set by this teacher. */
  context: {
    work: Array<{ title: string; due_at: string; status: "not_started" | "in_progress" | "done"; lessons_done: number; lessons_total: number }>;
  };
  /** The reader can send (false for an admin viewing as someone). */
  can_send: boolean;
}

/** Who the reader can start a conversation with. GET /me/contacts. */
export interface Contacts {
  /** Parents: each child with the teachers of their classes. */
  children: Array<{ id: string; name: string; teachers: Array<{ id: string; name: string; classes: string[] }> }>;
  /** Teachers: each class with its pupils and whether a parent is linked. */
  classes: Array<{ id: string; name: string; students: Array<{ id: string; name: string; parents: number }> }>;
}

/** POST /me/conversations: a parent names the child and the teacher; a teacher names the child. */
export interface ConversationOpen {
  child_id: string;
  teacher_id?: string;
}

/** POST /me/conversations/{id}/messages. */
export interface MessageCreate {
  body: string;
}

/** POST /me/conversations/{id}/progress: share a progress update, with an optional note. */
export interface ProgressShare {
  note?: string;
}

/** Parents: an announcement from one of their children's teachers. GET /me/announcements. */
export interface Announcement {
  id: string;
  title: string;
  body: string;
  class_name: string;
  teacher_name: string;
  /** Parents: which of their children are in the class. */
  children: string[];
  created_at: string;
  read: boolean;
  /** Teachers: how many families (parents and guardians) it reached, and how many have read it. */
  reach: { parents: number; read: number } | null;
}

/** POST /me/announcements (teachers). */
export interface AnnouncementCreate {
  class_id: string;
  title: string;
  body: string;
}

/** GET /me/unread: the badge in the menu. */
export interface UnreadCounts {
  messages: number;
  announcements: number;
}

/**
 * GET /me/events: a Server-Sent Events stream. Each event names what changed; the browser refetches it.
 * `ready` first; comments (": ping") keep the connection open; the server closes it after a while and the
 * browser reconnects (checking the session again).
 */
export type LiveEvent =
  | { type: "message"; conversation_id: string }
  | { type: "read"; conversation_id: string }
  | { type: "announcement"; announcement_id: string };

const id = (value: string) => encodeURIComponent(value);

export const messagePaths = {
  conversations: "/me/conversations",
  conversation: (conversationId: string) => `/me/conversations/${id(conversationId)}`,
  messages: (conversationId: string) => `/me/conversations/${id(conversationId)}/messages`,
  progress: (conversationId: string) => `/me/conversations/${id(conversationId)}/progress`,
  read: (conversationId: string) => `/me/conversations/${id(conversationId)}/read`,
  contacts: "/me/contacts",
  announcements: "/me/announcements",
  announcement: (announcementId: string) => `/me/announcements/${id(announcementId)}`,
  announcementRead: (announcementId: string) => `/me/announcements/${id(announcementId)}/read`,
  unread: "/me/unread",
  events: "/me/events",
} as const;
