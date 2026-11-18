import "server-only";

import { z } from "zod";
import type { Auth } from "@/server/auth/context";
import { getDb, type Executor } from "@/server/db";
import { forbidden, notFound } from "@/server/http/errors";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { publish } from "@/server/realtime/hub";
import { ANNOUNCEMENT_BODY_MAX, ANNOUNCEMENT_TITLE_MAX, type Announcement } from "@/features/messages/contract";
import { messagingRole } from "./access";

/**
 * Class announcements (FE-PAR-04): a verified teacher writes to a class; the parents and guardians of its
 * pupils see it in their inbox (live), and mark it read. The teacher sees how many families it reached and
 * how many have read it. Children never see announcements here.
 */

export const announcementCreateInput = z.object({
  class_id: z.uuid("Choose a class."),
  title: z.string().trim().min(1, "Give it a title.").max(ANNOUNCEMENT_TITLE_MAX, `Keep the title under ${ANNOUNCEMENT_TITLE_MAX} characters.`),
  body: z.string().trim().min(1, "Write the announcement.").max(ANNOUNCEMENT_BODY_MAX, `Keep it under ${ANNOUNCEMENT_BODY_MAX} characters.`),
});

/** The parents and guardians of a class's pupils (now). */
async function classParents(db: Executor, classId: string): Promise<string[]> {
  const rows = await db.guardianship.findMany({ where: { child: { classMemberships: { some: { classId } } } }, select: { parentId: true } });
  return [...new Set(rows.map((row) => row.parentId))];
}

export async function createAnnouncement(auth: Auth, input: z.output<typeof announcementCreateInput>): Promise<Announcement> {
  if ((await messagingRole(auth)) !== "teacher") throw forbidden("Only teachers post announcements.");
  if (auth.session.kind === "impersonation") throw forbidden("Support can't post announcements while viewing as someone.");
  const db = getDb();
  const klass = await db.class.findFirst({ where: { id: input.class_id, teacherId: auth.user.id }, select: { id: true, name: true } });
  if (!klass) throw notFound("That class");
  await enforceRateLimit(`announcements:${auth.user.id}`, 20, 60 * 60, "That's a lot of announcements in an hour. Try again later.");
  const row = await db.$transaction(async (tx) => {
    const created = await tx.announcement.create({ data: { classId: klass.id, teacherId: auth.user.id, title: input.title, body: input.body } });
    await publish(tx, [auth.user.id, ...(await classParents(tx, klass.id))], { type: "announcement", announcement_id: created.id });
    return created;
  });
  const parents = await classParents(db, klass.id);
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    class_name: klass.name,
    teacher_name: auth.user.displayName,
    children: [],
    created_at: row.createdAt.toISOString(),
    read: true,
    reach: { parents: parents.length, read: 0 },
  };
}

/** Teachers: their announcements, newest first, with how many families read them. Parents: theirs to read. */
export async function listAnnouncements(auth: Auth): Promise<Announcement[]> {
  const db = getDb();
  const role = await messagingRole(auth, db);
  if (role === "teacher") {
    const rows = await db.announcement.findMany({
      where: { teacherId: auth.user.id },
      include: { class: { select: { id: true, name: true } }, reads: { select: { userId: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const parentsByClass = new Map<string, string[]>();
    for (const classId of new Set(rows.map((row) => row.classId))) parentsByClass.set(classId, await classParents(db, classId));
    return rows.map((row) => {
      const parents = parentsByClass.get(row.classId) ?? [];
      return {
        id: row.id,
        title: row.title,
        body: row.body,
        class_name: row.class.name,
        teacher_name: auth.user.displayName,
        children: [],
        created_at: row.createdAt.toISOString(),
        read: true,
        reach: { parents: parents.length, read: row.reads.filter((read) => parents.includes(read.userId)).length },
      };
    });
  }
  const children = await db.guardianship.findMany({
    where: { parentId: auth.user.id },
    select: { child: { select: { displayName: true, classMemberships: { select: { classId: true } } } } },
  });
  const childrenByClass = new Map<string, string[]>();
  for (const { child } of children) {
    for (const { classId } of child.classMemberships) childrenByClass.set(classId, [...(childrenByClass.get(classId) ?? []), child.displayName]);
  }
  const rows = await db.announcement.findMany({
    where: { classId: { in: [...childrenByClass.keys()] } },
    include: { class: { select: { name: true } }, teacher: { select: { displayName: true } }, reads: { where: { userId: auth.user.id }, select: { userId: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    class_name: row.class.name,
    teacher_name: row.teacher.displayName,
    children: childrenByClass.get(row.classId) ?? [],
    created_at: row.createdAt.toISOString(),
    read: row.reads.length > 0,
    reach: null,
  }));
}

/** Unread announcements for a parent (the menu badge). */
export async function unreadAnnouncements(parentId: string, db: Executor = getDb()): Promise<number> {
  return db.announcement.count({
    where: {
      class: { members: { some: { student: { guardedBy: { some: { parentId } } } } } },
      reads: { none: { userId: parentId } },
    },
  });
}

/** A parent marks an announcement read (only one meant for them). */
export async function markAnnouncementRead(auth: Auth, announcementId: string): Promise<void> {
  if ((await messagingRole(auth)) !== "parent") throw forbidden("Only parents mark announcements read.");
  const db = getDb();
  const row = await db.announcement.findFirst({
    where: { id: announcementId, class: { members: { some: { student: { guardedBy: { some: { parentId: auth.user.id } } } } } } },
    select: { id: true },
  });
  if (!row) throw notFound("That announcement");
  await db.announcementRead.createMany({ data: [{ announcementId: row.id, userId: auth.user.id }], skipDuplicates: true });
  await publish(db, [auth.user.id], { type: "announcement", announcement_id: row.id });
}

/** A teacher takes down one of their announcements. */
export async function deleteAnnouncement(auth: Auth, announcementId: string): Promise<void> {
  if ((await messagingRole(auth)) !== "teacher") throw forbidden("Only teachers remove announcements.");
  if (auth.session.kind === "impersonation") throw forbidden("Support can't remove announcements while viewing as someone.");
  const db = getDb();
  const row = await db.announcement.findFirst({ where: { id: announcementId, teacherId: auth.user.id }, select: { id: true, classId: true } });
  if (!row) throw notFound("That announcement");
  const parents = await classParents(db, row.classId);
  await db.$transaction(async (tx) => {
    await tx.announcement.delete({ where: { id: row.id } });
    await publish(tx, [auth.user.id, ...parents], { type: "announcement", announcement_id: row.id });
  });
}
