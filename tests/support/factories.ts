import type { Prisma } from "@/generated/prisma/client";
import { hashPassword, pictureSecret } from "@/server/auth/password";
import { getDb, type UserRow } from "@/server/db";
import { outbox } from "@/server/mail";

export const PASSWORD = "correct horse battery";

let sequence = 0;
const next = () => ++sequence;

/** Creates a user directly in the database. Adults get a verified email and PASSWORD by default. */
export async function createUser(
  overrides: Partial<Prisma.UserUncheckedCreateInput> & { password?: string | null; pictures?: string[] } = {},
): Promise<UserRow> {
  const { password = PASSWORD, pictures, ...values } = overrides;
  const n = next();
  const role = values.role ?? "parent";
  const user = await getDb().user.create({
    data: {
      role,
      displayName: `${role[0]!.toUpperCase()}${role.slice(1)} ${n}`,
      email: role === "student" ? null : `${role}${n}@example.test`,
      emailVerifiedAt: role === "student" ? null : new Date(),
      passwordHash: password ? await hashPassword(password) : null,
      pictureHash: pictures ? await hashPassword(pictureSecret(pictures)) : null,
      ...values,
    },
  });
  if (role === "teacher") await getDb().teacherProfile.createMany({ data: [{ userId: user.id }], skipDuplicates: true });
  return user;
}

export async function linkChild(parent: UserRow, child: UserRow) {
  await getDb().guardianship.create({ data: { parentId: parent.id, childId: child.id } });
}

export async function createClass(teacher: UserRow, students: UserRow[], code = "TEST42") {
  const created = await getDb().class.create({ data: { teacherId: teacher.id, name: "Class 1T", code } });
  if (students.length) await getDb().classMember.createMany({ data: students.map((student) => ({ classId: created.id, studentId: student.id })) });
  return created;
}

export async function createCatalog() {
  const maths = await getDb().subject.create({ data: { slug: "mathematics", name: "Mathematics" } });
  const science = await getDb().subject.create({ data: { slug: "science", name: "Science" } });
  const created = await getDb().course.createManyAndReturn({
    data: [
      { slug: "fractions", title: "Fractions Made Simple", summary: "Halves, quarters and more.", gradeLevel: 4, subjectId: maths.id, status: "published", publishedAt: new Date() },
      { slug: "counting", title: "Counting to 100", summary: "Numbers 1 to 100.", gradeLevel: 1, subjectId: maths.id, status: "published", publishedAt: new Date() },
      { slug: "plants", title: "Plants and How They Grow", summary: "Seeds and roots (100% fun).", gradeLevel: 4, subjectId: science.id, status: "published", publishedAt: new Date() },
      { slug: "secret-draft", title: "Secret Draft", summary: "Not ready.", gradeLevel: 4, subjectId: maths.id, status: "draft" },
    ],
  });
  const id = (slug: string) => created.find((course) => course.slug === slug)!.id;
  await getDb().lesson.createMany({
    data: [
      { courseId: id("fractions"), slug: "what-is-a-fraction", title: "What is a fraction?", summary: "Halves, thirds and quarters.", position: 1, durationMinutes: 12 },
      { courseId: id("fractions"), slug: "equivalent-fractions", title: "Equivalent fractions", summary: "One half is two quarters.", position: 2, durationMinutes: 15 },
      { courseId: id("plants"), slug: "parts-of-a-plant", title: "Parts of a plant", summary: "Roots, stem, leaves and flowers.", position: 1, durationMinutes: 12 },
      { courseId: id("counting"), slug: "tens-and-ones", title: "Tens and ones", summary: "Group objects in tens to count quickly.", position: 1, durationMinutes: 10 },
      { courseId: id("secret-draft"), slug: "hidden-fractions", title: "Hidden fractions lesson", summary: "In a draft course.", position: 1, durationMinutes: 10 },
    ],
  });
  return { maths, science };
}

export async function reloadUser(id: string) {
  return getDb().user.findUnique({ where: { id } });
}

/** The token in the newest email to `to` (links look like …?token=XYZ). */
export function tokenFromEmail(to: string, subject?: RegExp): string {
  const mail = [...outbox].reverse().find((item) => item.to === to && (!subject || subject.test(item.subject)));
  if (!mail) throw new Error(`No email to ${to}${subject ? ` matching ${subject}` : ""}. Outbox: ${outbox.map((item) => `${item.to}: ${item.subject}`).join("; ")}`);
  const match = mail.text.match(/token=([A-Za-z0-9_%-]+)/);
  if (!match) throw new Error(`No token in "${mail.subject}"`);
  return decodeURIComponent(match[1]!);
}
