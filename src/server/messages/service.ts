import "server-only";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { Auth } from "@/server/auth/context";
import { getDb, type Executor } from "@/server/db";
import { forbidden, HttpError, notFound } from "@/server/http/errors";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { childProgress } from "@/server/family/progress";
import { publish } from "@/server/realtime/hub";
import { assignmentStatus, dueInfo } from "@/features/learn/assignments";
import { formatMinutes } from "@/features/learn/controls";
import {
  MESSAGE_MAX_LENGTH,
  type Contacts,
  type ConversationSummary,
  type ConversationView,
  type Message,
  type ProgressSnapshot,
  type UnreadCounts,
} from "@/features/messages/contract";
import { messagingRole, type Role } from "./access";
import { unreadAnnouncements } from "./announcements";

/**
 * Conversations between parents and teachers about a child (FE-PAR-04), under /api/me.
 *
 * The rule, checked on every read and write: a conversation is between one teacher and one child's parents
 * and guardians (all of them), and it is open while
 *   - the teacher is verified (an admin checked them: the safety page promises it), and
 *   - the teacher teaches at least one class the child is in, and
 *   - the reader is that teacher, or one of the child's guardians.
 * When that stops being true (the child moves class), the conversation is no longer shown to the teacher or
 * the parents. Children never see messages. Text is plain text (React escapes it), never HTML.
 *
 * Teachers see a child's progress only on the work they set (the privacy policy promises it), so the
 * context panel and a teacher's progress update hold only that; a parent's update shares home learning
 * only when the parent presses the button.
 */

const messageInput = z.object({ body: z.string().trim().min(1, "Write a message first.").max(MESSAGE_MAX_LENGTH, `Keep it under ${MESSAGE_MAX_LENGTH} characters.`) });
export const messageCreateInput = messageInput;
export const progressShareInput = z.object({ note: z.string().trim().max(MESSAGE_MAX_LENGTH).optional() });
export const conversationOpenInput = z.object({ child_id: z.uuid("Choose a child."), teacher_id: z.uuid("Choose a teacher.").optional() });
export const conversationQuery = z.object({ before: z.iso.datetime({ offset: true }).optional() });

const PAGE = 50;

function assertCanWrite(auth: Auth) {
  if (auth.session.kind === "impersonation") throw forbidden("Support can read, but not send messages, while viewing as someone.");
}

/** The teacher's classes the child is in (empty: the teacher doesn't teach the child). Verified teachers only. */
async function sharedClasses(db: Executor, teacherId: string, childId: string): Promise<string[]> {
  const rows = await db.class.findMany({
    where: { teacherId, members: { some: { studentId: childId } }, teacher: { teacherProfile: { verifiedAt: { not: null } } } },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => row.name);
}

async function guardiansOf(db: Executor, childId: string) {
  const rows = await db.guardianship.findMany({ where: { childId }, include: { parent: { select: { id: true, displayName: true } } }, orderBy: { createdAt: "asc" } });
  return rows.map((row) => row.parent);
}

const firstName = (name: string) => name.split(" ")[0]!;

/** The conversation, if the reader may see it now (404 otherwise, never "forbidden": it doesn't exist for them). */
async function accessible(auth: Auth, conversationId: string, db: Executor = getDb()) {
  const role = await messagingRole(auth, db);
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { teacher: { select: { id: true, displayName: true } }, child: { select: { id: true, displayName: true, gradeLevel: true } } },
  });
  if (!conversation) throw notFound("That conversation");
  if (role === "teacher" && conversation.teacherId !== auth.user.id) throw notFound("That conversation");
  if (role === "parent") {
    const guardian = await db.guardianship.findUnique({ where: { parentId_childId: { parentId: auth.user.id, childId: conversation.childId } } });
    if (!guardian) throw notFound("That conversation");
  }
  const classes = await sharedClasses(db, conversation.teacherId, conversation.childId);
  if (classes.length === 0) throw notFound("That conversation");
  return { role, conversation, classes };
}

/** Who takes part: the teacher and every guardian of the child. */
async function participantIds(db: Executor, conversation: { teacherId: string; childId: string }) {
  return [conversation.teacherId, ...(await guardiansOf(db, conversation.childId)).map((parent) => parent.id)];
}

type MessageRow = {
  id: string;
  conversationId: string;
  kind: "text" | "progress";
  body: string;
  data: unknown;
  createdAt: Date;
  sender: { id: string; displayName: string; role: string } | null;
};

function toMessage(row: MessageRow, readerId: string, childName: string): Message {
  return {
    id: row.id,
    conversation_id: row.conversationId,
    kind: row.kind,
    body: row.body,
    snapshot: row.kind === "progress" ? (row.data as ProgressSnapshot) : null,
    sender: row.sender
      ? { id: row.sender.id, name: row.sender.displayName, role_label: row.sender.role === "teacher" ? "Teacher" : `${firstName(childName)}'s parent` }
      : null,
    mine: row.sender?.id === readerId,
    created_at: row.createdAt.toISOString(),
  };
}

const senderSelect = { select: { id: true, displayName: true, role: true } } as const;

/** Unread messages per conversation for this reader: messages from others after their last read. */
async function unreadFor(db: Executor, userId: string, conversationIds: string[]): Promise<Map<string, number>> {
  if (conversationIds.length === 0) return new Map();
  const rows = await db.$queryRaw<Array<{ conversation_id: string; unread: number }>>`
    select m.conversation_id, count(*)::int as unread
    from messages m
    left join conversation_reads r on r.conversation_id = m.conversation_id and r.user_id = ${userId}::uuid
    where m.conversation_id = any(${conversationIds}::uuid[])
      and m.sender_id is distinct from ${userId}::uuid
      and (r.last_read_at is null or m.created_at > r.last_read_at)
    group by m.conversation_id`;
  return new Map(rows.map((row) => [row.conversation_id, row.unread]));
}

/** The conversations the reader may see now, with the last message and unread count, latest first. */
async function visibleConversations(auth: Auth, role: Role, db: Executor) {
  const rows = await db.conversation.findMany({
    where: role === "teacher" ? { teacherId: auth.user.id } : { child: { guardedBy: { some: { parentId: auth.user.id } } } },
    include: {
      teacher: { select: { id: true, displayName: true } },
      child: { select: { id: true, displayName: true, gradeLevel: true } },
      messages: { take: 1, orderBy: { createdAt: "desc" }, include: { sender: senderSelect } },
    },
  });
  const withClasses = await Promise.all(rows.map(async (row) => ({ row, classes: await sharedClasses(db, row.teacherId, row.childId) })));
  return withClasses.filter((entry) => entry.classes.length > 0);
}

function toSummary(row: Awaited<ReturnType<typeof visibleConversations>>[number]["row"], classes: string[], unread: number, readerId: string): ConversationSummary {
  const last = row.messages[0];
  return {
    id: row.id,
    child: { id: row.child.id, name: row.child.displayName, grade_level: row.child.gradeLevel },
    teacher: { id: row.teacher.id, name: row.teacher.displayName },
    classes,
    last_message: last
      ? {
          preview: (last.kind === "progress" ? `Progress update${last.body ? `: ${last.body}` : ""}` : last.body).slice(0, 140),
          at: last.createdAt.toISOString(),
          sender_name: last.sender?.displayName ?? null,
          mine: last.senderId === readerId,
        }
      : null,
    unread,
  };
}

export async function listConversations(auth: Auth): Promise<ConversationSummary[]> {
  const db = getDb();
  const role = await messagingRole(auth, db);
  const visible = await visibleConversations(auth, role, db);
  const unread = await unreadFor(db, auth.user.id, visible.map((entry) => entry.row.id));
  return visible
    .map(({ row, classes }) => toSummary(row, classes, unread.get(row.id) ?? 0, auth.user.id))
    .sort((a, b) => (b.last_message?.at ?? "").localeCompare(a.last_message?.at ?? "") || a.child.name.localeCompare(b.child.name));
}

/** The child's work set by this teacher, with the child's status (what both sides may see here). */
async function teacherWork(db: Executor, teacherId: string, childId: string) {
  const rows = await db.assignment.findMany({
    where: { class: { teacherId, members: { some: { studentId: childId } } }, course: { status: "published" } },
    include: { course: { select: { lessons: { select: { id: true } } } }, lesson: { select: { id: true } }, class: { select: { name: true } } },
    orderBy: { dueAt: "asc" },
  });
  const lessonIds = [...new Set(rows.flatMap((row) => (row.lesson ? [row.lesson.id] : row.course.lessons.map((lesson) => lesson.id))))];
  const progress = await db.lessonProgress.findMany({ where: { studentId: childId, lessonId: { in: lessonIds } }, select: { lessonId: true, status: true } });
  const status = new Map(progress.map((row) => [row.lessonId, row.status]));
  return rows.map((row) => {
    const targets = row.lesson ? [row.lesson.id] : row.course.lessons.map((lesson) => lesson.id);
    const done = targets.filter((id) => status.get(id) === "completed").length;
    return {
      title: row.title,
      class_name: row.class.name,
      due_at: row.dueAt.toISOString(),
      status: assignmentStatus(done, targets.length, targets.some((id) => status.has(id))),
      lessons_done: done,
      lessons_total: targets.length,
    };
  });
}

export async function conversationView(auth: Auth, conversationId: string, { before }: z.output<typeof conversationQuery> = {}): Promise<ConversationView> {
  const db = getDb();
  const { role, conversation, classes } = await accessible(auth, conversationId, db);
  const [rows, guardians, work, unread] = await Promise.all([
    db.message.findMany({
      where: { conversationId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      include: { sender: senderSelect },
      orderBy: { createdAt: "desc" },
      take: PAGE + 1,
    }),
    guardiansOf(db, conversation.childId),
    teacherWork(db, conversation.teacherId, conversation.childId),
    unreadFor(db, auth.user.id, [conversationId]),
  ]);
  const page = rows.slice(0, PAGE).reverse();
  const childName = conversation.child.displayName;
  const summaryRow = { ...conversation, messages: rows.slice(0, 1) };
  return {
    ...toSummary(summaryRow, classes, unread.get(conversationId) ?? 0, auth.user.id),
    participants: [
      { id: conversation.teacher.id, name: conversation.teacher.displayName, role_label: "Teacher" },
      ...guardians.map((parent) => ({ id: parent.id, name: parent.displayName, role_label: `${firstName(childName)}'s parent` })),
    ],
    messages: page.map((row) => toMessage(row, auth.user.id, childName)),
    has_more: rows.length > PAGE,
    context: { work: work.map((row) => ({ title: row.title, due_at: row.due_at, status: row.status, lessons_done: row.lessons_done, lessons_total: row.lessons_total })) },
    can_send: auth.session.kind !== "impersonation" && (role === "teacher" || guardians.some((parent) => parent.id === auth.user.id)),
  };
}

/**
 * Opens (or finds) the conversation about a child: a parent names their child and one of the child's
 * teachers; a teacher names a pupil of theirs who has a parent on Lumina. One conversation per teacher
 * and child, so asking twice returns the same one.
 */
export async function openConversation(auth: Auth, input: z.output<typeof conversationOpenInput>): Promise<{ id: string; created: boolean }> {
  const db = getDb();
  const role = await messagingRole(auth, db);
  let teacherId: string;
  if (role === "parent") {
    if (!input.teacher_id) throw new HttpError(422, "validation_error", "Choose a teacher.", { details: [{ field: "body.teacher_id", message: "Choose a teacher." }] });
    const guardian = await db.guardianship.findUnique({ where: { parentId_childId: { parentId: auth.user.id, childId: input.child_id } } });
    if (!guardian) throw notFound("That child");
    teacherId = input.teacher_id;
    if ((await sharedClasses(db, teacherId, input.child_id)).length === 0) throw notFound("That teacher");
  } else {
    teacherId = auth.user.id;
    if ((await sharedClasses(db, teacherId, input.child_id)).length === 0) throw notFound("That pupil");
    if ((await guardiansOf(db, input.child_id)).length === 0) {
      throw new HttpError(409, "no_parent", "This pupil has no parent or guardian on Lumina yet, so there is nobody to write to.");
    }
  }
  const existing = await db.conversation.findUnique({ where: { teacherId_childId: { teacherId, childId: input.child_id } }, select: { id: true } });
  if (existing) return { id: existing.id, created: false };
  const created = await db.conversation.createManyAndReturn({ data: [{ teacherId, childId: input.child_id }], skipDuplicates: true, select: { id: true } });
  if (created[0]) return { id: created[0].id, created: true };
  const raced = await db.conversation.findUniqueOrThrow({ where: { teacherId_childId: { teacherId, childId: input.child_id } }, select: { id: true } });
  return { id: raced.id, created: false };
}

/** Stores a message, marks it read for the sender, and tells everyone in the conversation (live). */
async function post(auth: Auth, conversationId: string, data: { kind: "text" | "progress"; body: string; data?: ProgressSnapshot }): Promise<Message> {
  assertCanWrite(auth);
  const db = getDb();
  const { conversation } = await accessible(auth, conversationId, db);
  await enforceRateLimit(`messages:${auth.user.id}`, 30, 10 * 60, "That's a lot of messages in a short time. Wait a few minutes, then send again.");
  const row = await db.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: { conversationId, senderId: auth.user.id, kind: data.kind, body: data.body, data: data.data ? (data.data as unknown as Prisma.InputJsonObject) : Prisma.DbNull },
      include: { sender: senderSelect },
    });
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: message.createdAt } });
    await tx.conversationRead.upsert({
      where: { conversationId_userId: { conversationId, userId: auth.user.id } },
      create: { conversationId, userId: auth.user.id, lastReadAt: message.createdAt },
      update: { lastReadAt: message.createdAt },
    });
    await publish(tx, await participantIds(tx, conversation), { type: "message", conversation_id: conversationId });
    return message;
  });
  return toMessage(row, auth.user.id, conversation.child.displayName);
}

export async function sendMessage(auth: Auth, conversationId: string, { body }: z.output<typeof messageCreateInput>): Promise<Message> {
  return post(auth, conversationId, { kind: "text", body });
}

const statusText = { done: "Done", in_progress: "In progress", not_started: "Not started" } as const;

/**
 * A progress update: a snapshot of what the sender may share, frozen in the message.
 * Teachers: the child's work they set (status, due). Parents: learning at home over the last 7 days.
 */
export async function shareProgress(auth: Auth, conversationId: string, { note }: z.output<typeof progressShareInput>, now = new Date()): Promise<Message> {
  const db = getDb();
  const { role, conversation, classes } = await accessible(auth, conversationId, db);
  let snapshot: ProgressSnapshot;
  if (role === "teacher") {
    const work = await teacherWork(db, conversation.teacherId, conversation.childId);
    snapshot = {
      title: `Work in ${classes.join(", ")}`,
      as_of: now.toISOString(),
      items: work.length
        ? work.map((row) => {
            const due = dueInfo(row.due_at, row.status, now);
            return {
              label: row.title,
              value: `${statusText[row.status]}${row.lessons_total > 1 ? ` (${row.lessons_done} of ${row.lessons_total} lessons)` : ""} · ${due.label}`,
              tone: row.status === "done" ? ("good" as const) : due.tone === "overdue" ? ("attention" as const) : ("neutral" as const),
            };
          })
        : [{ label: "Work set", value: "No work set yet", tone: "neutral" as const }],
    };
  } else {
    const progress = await childProgress(auth, conversation.childId, { days: 7 }, now);
    const latest = progress.quizzes.find((row) => row.status === "submitted");
    snapshot = {
      title: "Learning at home",
      as_of: now.toISOString(),
      items: [
        { label: "Time in lessons, last 7 days", value: progress.period.minutes ? formatMinutes(progress.period.minutes) : "None", tone: "neutral" },
        { label: "Days with learning, last 7 days", value: String(progress.period.active_days), tone: progress.period.active_days >= 3 ? "good" : "neutral" },
        { label: "Lessons finished, last 7 days", value: String(progress.period.lessons_completed), tone: "neutral" },
        { label: "Streak", value: `${progress.summary.streak_days} ${progress.summary.streak_days === 1 ? "day" : "days"}`, tone: "neutral" },
        ...(latest ? [{ label: `Latest quiz: ${latest.quiz}`, value: latest.percent === null ? "written answers, not marked yet" : `${latest.percent}%`, tone: (latest.percent ?? 100) >= 80 ? ("good" as const) : (latest.percent ?? 100) < 60 ? ("attention" as const) : ("neutral" as const) }] : []),
        ...progress.courses.filter((course) => !course.completed_at).slice(0, 3).map((course) => ({ label: course.title, value: `${course.lessons_completed} of ${course.lessons_total} lessons`, tone: "neutral" as const })),
      ],
    };
  }
  return post(auth, conversationId, { kind: "progress", body: note ?? "", data: snapshot });
}

/** Marks the conversation read up to now, and tells the reader's other tabs (the menu badge). */
export async function markConversationRead(auth: Auth, conversationId: string, now = new Date()): Promise<void> {
  const db = getDb();
  await accessible(auth, conversationId, db);
  await db.$transaction(async (tx) => {
    await tx.conversationRead.upsert({
      where: { conversationId_userId: { conversationId, userId: auth.user.id } },
      create: { conversationId, userId: auth.user.id, lastReadAt: now },
      update: { lastReadAt: now },
    });
    await publish(tx, [auth.user.id], { type: "read", conversation_id: conversationId });
  });
}

/** Who the reader can start a conversation with. */
export async function contacts(auth: Auth): Promise<Contacts> {
  const db = getDb();
  const role = await messagingRole(auth, db);
  if (role === "parent") {
    const children = await db.guardianship.findMany({ where: { parentId: auth.user.id }, include: { child: { select: { id: true, displayName: true } } }, orderBy: { createdAt: "asc" } });
    return {
      classes: [],
      children: await Promise.all(
        children.map(async ({ child }) => {
          const classes = await db.class.findMany({
            where: { members: { some: { studentId: child.id } }, teacher: { teacherProfile: { verifiedAt: { not: null } } } },
            include: { teacher: { select: { id: true, displayName: true } } },
            orderBy: { name: "asc" },
          });
          const teachers = new Map<string, { id: string; name: string; classes: string[] }>();
          for (const klass of classes) {
            const entry = teachers.get(klass.teacher.id) ?? { id: klass.teacher.id, name: klass.teacher.displayName, classes: [] };
            entry.classes.push(klass.name);
            teachers.set(klass.teacher.id, entry);
          }
          return { id: child.id, name: child.displayName, teachers: [...teachers.values()] };
        }),
      ),
    };
  }
  const classes = await db.class.findMany({
    where: { teacherId: auth.user.id },
    include: { members: { include: { student: { select: { id: true, displayName: true, _count: { select: { guardedBy: true } } } } } } },
    orderBy: { name: "asc" },
  });
  return {
    children: [],
    classes: classes.map((klass) => ({
      id: klass.id,
      name: klass.name,
      students: klass.members
        .map((member) => ({ id: member.student.id, name: member.student.displayName, parents: member.student._count.guardedBy }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })),
  };
}

/** The menu badge: unread messages, and (parents) unread announcements. */
export async function unreadCounts(auth: Auth): Promise<UnreadCounts> {
  const db = getDb();
  const role = await messagingRole(auth, db);
  const visible = await visibleConversations(auth, role, db);
  const unread = await unreadFor(db, auth.user.id, visible.map((entry) => entry.row.id));
  return {
    messages: [...unread.values()].reduce((sum, count) => sum + count, 0),
    announcements: role === "parent" ? await unreadAnnouncements(auth.user.id, db) : 0,
  };
}
