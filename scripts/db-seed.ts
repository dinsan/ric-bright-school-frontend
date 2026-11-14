/**
 * Fills a development database with a sample catalog and one demo account per role. Idempotent: run it
 * again and existing rows are kept (matched by slug, email, username and class code).
 *
 *   npm run db:seed
 *
 * Refuses to run with NODE_ENV=production unless --force is given: the demo accounts have known passwords.
 */
import { loadEnvConfig } from "@next/env";
import type { Prisma } from "../src/generated/prisma/client";

loadEnvConfig(process.cwd());

const DEMO_PASSWORD = "lumina-demo-password";
const CLASS_CODE = "MAPLE42";
/** Leo's class (Grade 5), with assignments. */
const LEO_CLASS_CODE = "OAK55";
/** The picture password of the demo student in the class. */
const DEMO_PICTURES = ["cat", "sun", "tree"];

const SUBJECTS = [
  { slug: "mathematics", name: "Mathematics", description: "Numbers, shapes, patterns and problem solving." },
  { slug: "reading-writing", name: "Reading and Writing", description: "Phonics, stories, grammar and writing for every purpose." },
  { slug: "science", name: "Science", description: "How the living and physical world works, through questions and experiments." },
  { slug: "history", name: "History", description: "People, places and events that shaped the world." },
  { slug: "geography", name: "Geography", description: "Maps, landscapes, climates and communities." },
  { slug: "computing", name: "Computing", description: "Algorithms, programming and staying safe online." },
  { slug: "art-design", name: "Art and Design", description: "Drawing, colour, making and looking closely." },
  { slug: "languages", name: "Languages", description: "First steps in a new language." },
];

/** `price` in cents (0 or missing = free). Grades 1-5 are free in the sample catalog. */
type CourseSeed = { slug: string; title: string; subject: string; grade: number; summary: string; description?: string; price?: number };

const COURSES: CourseSeed[] = [
  { slug: "counting-to-100", title: "Counting to 100", subject: "mathematics", grade: 1, summary: "Count, read and write numbers to 100, and find patterns on the hundred square." },
  { slug: "phonics-first-sounds", title: "Phonics: First Sounds", subject: "reading-writing", grade: 1, summary: "Learn letter sounds and blend them to read simple words." },
  { slug: "living-things-around-us", title: "Living Things Around Us", subject: "science", grade: 1, summary: "Plants, animals and what they need to stay alive." },
  { slug: "adding-and-subtracting-within-20", title: "Adding and Subtracting within 20", subject: "mathematics", grade: 2, summary: "Number bonds, fact families and word problems up to 20." },
  { slug: "my-first-stories", title: "My First Stories", subject: "reading-writing", grade: 2, summary: "Plan, write and share a short story with a beginning, middle and end." },
  { slug: "maps-of-my-town", title: "Maps of My Town", subject: "geography", grade: 2, summary: "Read simple maps, use a key and give directions." },
  { slug: "multiplication-facts", title: "Multiplication Facts", subject: "mathematics", grade: 3, summary: "Times tables from 2 to 10, with arrays, skip counting and quick recall games." },
  { slug: "plants-and-how-they-grow", title: "Plants and How They Grow", subject: "science", grade: 3, summary: "Seeds, roots, leaves and flowers: grow a plant and record what happens." },
  { slug: "fractions-made-simple", title: "Fractions Made Simple", subject: "mathematics", grade: 4, summary: "Understand, compare and add fractions with pictures and number lines.", description: "Unit 1: What is a fraction?\nUnit 2: Equivalent fractions\nUnit 3: Comparing fractions\nUnit 4: Adding and subtracting fractions with the same denominator" },
  { slug: "ancient-egypt", title: "Ancient Egypt", subject: "history", grade: 4, summary: "Pharaohs, pyramids, hieroglyphs and life along the Nile." },
  { slug: "coding-with-blocks", title: "Coding with Blocks", subject: "computing", grade: 4, summary: "Sequences, loops and events: make an animation and a simple game." },
  { slug: "decimals-and-percentages", title: "Decimals and Percentages", subject: "mathematics", grade: 5, summary: "Place value to thousandths, and how decimals, fractions and percentages connect." },
  { slug: "the-water-cycle", title: "The Water Cycle", subject: "science", grade: 5, summary: "Evaporation, condensation and precipitation, with experiments you can do at home." },
  { slug: "persuasive-writing", title: "Persuasive Writing", subject: "reading-writing", grade: 5, summary: "Make a case: opinions, reasons, evidence and a strong ending." },
  { slug: "ratios-and-rates", title: "Ratios and Rates", subject: "mathematics", grade: 6, summary: "Ratio language, unit rates and tables for solving real problems.", price: 900 },
  { slug: "cells-the-building-blocks-of-life", title: "Cells: the Building Blocks of Life", subject: "science", grade: 6, summary: "Plant and animal cells, microscopes and what each part does.", price: 900 },
  { slug: "spanish-for-beginners", title: "Spanish for Beginners", subject: "languages", grade: 6, summary: "Greetings, numbers, family and everyday phrases.", price: 1200 },
  { slug: "pre-algebra", title: "Pre-Algebra", subject: "mathematics", grade: 7, summary: "Expressions, equations and inequalities with one variable.", price: 1200 },
  { slug: "world-climates", title: "World Climates", subject: "geography", grade: 7, summary: "Climate zones, weather patterns and how climate shapes how people live.", price: 900 },
  { slug: "introduction-to-python", title: "Introduction to Python", subject: "computing", grade: 8, summary: "Variables, conditions, loops and functions: write your first real programs.", price: 1500 },
  { slug: "chemistry-basics", title: "Chemistry Basics", subject: "science", grade: 8, summary: "Atoms, elements, the periodic table and simple reactions.", price: 1200 },
  { slug: "algebra-1", title: "Algebra 1", subject: "mathematics", grade: 9, summary: "Linear equations, functions, systems and an introduction to quadratics.", price: 1500 },
  { slug: "the-industrial-revolution", title: "The Industrial Revolution", subject: "history", grade: 9, summary: "Machines, cities and workers: how industry changed everyday life.", price: 900 },
  { slug: "geometry", title: "Geometry", subject: "mathematics", grade: 10, summary: "Proof, congruence, similarity, circles and coordinate geometry.", price: 1500 },
  { slug: "biology-genetics", title: "Biology: Genetics", subject: "science", grade: 10, summary: "DNA, inheritance, variation and how traits pass between generations.", price: 1200 },
  { slug: "drawing-from-observation", title: "Drawing from Observation", subject: "art-design", grade: 10, summary: "Line, tone, proportion and perspective, drawing what you see.", price: 900 },
  { slug: "precalculus", title: "Precalculus", subject: "mathematics", grade: 11, summary: "Functions, trigonometry, sequences and limits: ready for calculus.", price: 1900 },
  { slug: "data-structures-and-algorithms", title: "Data Structures and Algorithms", subject: "computing", grade: 11, summary: "Lists, trees, searching and sorting, and how to reason about speed.", price: 1900 },
  { slug: "calculus", title: "Calculus", subject: "mathematics", grade: 12, summary: "Derivatives, integrals and their applications.", price: 1900 },
  { slug: "physics-mechanics", title: "Physics: Mechanics", subject: "science", grade: 12, summary: "Motion, forces, energy and momentum with real-world problems.", price: 1900 },
];

/** Learning paths: in each list, a course requires the one before it (see src/features/learn/path.ts). */
const PATHS: string[][] = [
  ["counting-to-100", "adding-and-subtracting-within-20", "multiplication-facts", "fractions-made-simple", "decimals-and-percentages", "ratios-and-rates", "pre-algebra", "algebra-1", "geometry", "precalculus", "calculus"],
  ["living-things-around-us", "plants-and-how-they-grow", "the-water-cycle", "cells-the-building-blocks-of-life", "chemistry-basics", "biology-genetics"],
  ["chemistry-basics", "physics-mechanics"],
  ["phonics-first-sounds", "my-first-stories", "persuasive-writing"],
  ["maps-of-my-town", "world-climates"],
  ["coding-with-blocks", "introduction-to-python", "data-structures-and-algorithms"],
];

/** A draft course: in the database, but never listed (only published courses are public). */
const DRAFT: CourseSeed = { slug: "statistics-draft", title: "Statistics (draft)", subject: "mathematics", grade: 11, summary: "Not published yet." };

async function main() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    throw new Error("Refusing to seed demo accounts with NODE_ENV=production (pass --force if you really mean it).");
  }
  // Imported after the env is loaded: the config is read when the client is created.
  const { closeDb, getDb } = await import("../src/server/db");
  const { LESSONS, lessonSlug } = await import("./seed-lessons");
  const { lessonContent } = await import("./seed-content");
  const { hashPassword, pictureSecret } = await import("../src/server/auth/password");
  const db = getDb();

  try {
    // --- Catalog --- (createMany + skipDuplicates: INSERT … ON CONFLICT DO NOTHING, rows already there stay)
    await db.subject.createMany({ data: SUBJECTS, skipDuplicates: true });
    const subjectIds = new Map((await db.subject.findMany({ select: { id: true, slug: true } })).map((row) => [row.slug, row.id]));
    const published = new Date("2025-01-15T09:00:00Z");
    await db.course.createMany({
      data: [...COURSES.map((course) => ({ ...course, status: "published" as const })), { ...DRAFT, status: "draft" as const }].map((course) => ({
        slug: course.slug,
        title: course.title,
        summary: course.summary,
        description: course.description ?? null,
        gradeLevel: course.grade,
        subjectId: subjectIds.get(course.subject)!,
        status: course.status,
        priceCents: course.price ?? 0,
        publishedAt: course.status === "published" ? published : null,
      })),
      skipDuplicates: true,
    });
    const courseIds = new Map((await db.course.findMany({ select: { id: true, slug: true } })).map((row) => [row.slug, row.id]));
    const courseTitles = new Map(COURSES.map((course) => [course.slug, course.title]));
    const lessonRows = Object.entries(LESSONS).flatMap(([courseSlug, items]) =>
      items.map((item, index) => {
        const [title, summary, minutes] = item;
        return {
          courseId: courseIds.get(courseSlug)!,
          slug: lessonSlug(title),
          title,
          summary,
          position: index + 1,
          durationMinutes: minutes,
          content: lessonContent(courseSlug, courseTitles.get(courseSlug) ?? courseSlug, lessonSlug(title), item, items) as Prisma.InputJsonArray,
        };
      }),
    );
    await db.lesson.createMany({ data: lessonRows, skipDuplicates: true });
    // Lessons seeded before there was content get it now; content someone wrote is never replaced.
    for (const row of lessonRows) {
      await db.lesson.updateMany({ where: { courseId: row.courseId, slug: row.slug, content: { equals: [] } }, data: { content: row.content } });
    }
    // Learning paths: each course builds on the one before it in its subject (course_prerequisites).
    const prerequisites = PATHS.flatMap((path) => path.slice(1).map((slug, index) => ({ courseId: courseIds.get(slug)!, requiresCourseId: courseIds.get(path[index]!)! })));
    await db.coursePrerequisite.createMany({ data: prerequisites, skipDuplicates: true });
    console.log(`[seed] catalog: ${SUBJECTS.length} subjects, ${COURSES.length} published courses (+1 draft), ${lessonRows.length} lessons`);

    // --- Demo accounts ---
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const verified = new Date();
    async function upsertUser(values: Prisma.UserUncheckedCreateInput) {
      const existing = await db.user.findUnique({ where: values.email ? { email: values.email } : { username: values.username! } });
      return existing ?? db.user.create({ data: values });
    }

    const admin = await upsertUser({ role: "admin", displayName: "Ada Admin", email: "admin@lumina.test", emailVerifiedAt: verified, passwordHash, language: "en" });
    const teacher = await upsertUser({ role: "teacher", displayName: "Tom Teacher", email: "teacher@lumina.test", emailVerifiedAt: verified, passwordHash, language: "en" });
    await db.teacherProfile.createMany({
      data: [{ userId: teacher.id, schoolName: "Maple Primary School", subjects: ["mathematics", "science"], gradeLevels: [1, 2, 3], bio: "Year 2 teacher who loves fractions and frogs.", verifiedAt: new Date(), verifiedById: admin.id }],
      skipDuplicates: true,
    });
    const parent = await upsertUser({ role: "parent", displayName: "Pat Parent", email: "parent@lumina.test", emailVerifiedAt: verified, passwordHash, language: "en" });
    const maya = await upsertUser({ role: "student", displayName: "Maya", username: "maya7", gradeLevel: 2, pictureHash: await hashPassword(pictureSecret(DEMO_PICTURES)), createdById: parent.id, language: "en" });
    const leo = await upsertUser({ role: "student", displayName: "Leo", username: "leo10", gradeLevel: 5, passwordHash, createdById: parent.id, language: "en" });
    await db.guardianship.createMany({
      data: [
        { parentId: parent.id, childId: maya.id, consentAt: new Date() },
        { parentId: parent.id, childId: leo.id, consentAt: new Date() },
      ],
      skipDuplicates: true,
    });
    if (!parent.activeChildId) await db.user.update({ where: { id: parent.id }, data: { activeChildId: maya.id } });

    await db.class.createMany({ data: [{ teacherId: teacher.id, name: "Class 2M (Mr Tom)", code: CLASS_CODE }], skipDuplicates: true });
    const klass = await db.class.findUniqueOrThrow({ where: { code: CLASS_CODE } });
    const sam = await upsertUser({ role: "student", displayName: "Sam", username: "sam2m", gradeLevel: 2, pictureHash: await hashPassword(pictureSecret(["dog", "star", "fish"])), language: "en" });
    await db.classMember.createMany({
      data: [
        { classId: klass.id, studentId: maya.id },
        { classId: klass.id, studentId: sam.id },
      ],
      skipDuplicates: true,
    });

    // Leo's class, with work set by the demo teacher (relative to the first seed: it ages like real work).
    await db.class.createMany({ data: [{ teacherId: teacher.id, name: "Class 5L (Mr Tom)", code: LEO_CLASS_CODE }], skipDuplicates: true });
    const leoClass = await db.class.findUniqueOrThrow({ where: { code: LEO_CLASS_CODE } });
    await db.classMember.createMany({ data: [{ classId: leoClass.id, studentId: leo.id }], skipDuplicates: true });
    if ((await db.assignment.count({ where: { classId: leoClass.id } })) === 0) {
      const fractionsCourse = await db.course.findUniqueOrThrow({ where: { slug: "fractions-made-simple" }, include: { lessons: { orderBy: { position: "asc" } } } });
      const ratiosCourse = await db.course.findUniqueOrThrow({ where: { slug: "ratios-and-rates" }, include: { lessons: { orderBy: { position: "asc" } } } });
      const inDays = (days: number) => new Date(Date.now() + days * 86_400_000);
      await db.assignment.createMany({
        data: [
          { classId: leoClass.id, teacherId: teacher.id, courseId: fractionsCourse.id, lessonId: fractionsCourse.lessons[1]!.id, title: "Equivalent fractions", instructions: "Use the fraction wall to check your answers.", dueAt: inDays(1) },
          { classId: leoClass.id, teacherId: teacher.id, courseId: fractionsCourse.id, title: "Finish Fractions Made Simple", dueAt: inDays(5) },
          { classId: leoClass.id, teacherId: teacher.id, courseId: ratiosCourse.id, lessonId: ratiosCourse.lessons[0]!.id, title: ratiosCourse.lessons[0]!.title, dueAt: inDays(12) },
        ],
      });
    }

    // --- Demo learning for Leo: one finished course (with its certificate) and two days of learning, so the
    // dashboard, badges and certificates have something to show. Only when Leo has no learning yet.
    if ((await db.enrollment.count({ where: { studentId: leo.id } })) === 0) {
      const finished = await db.course.findUniqueOrThrow({ where: { slug: "decimals-and-percentages" }, include: { subject: true, lessons: { orderBy: { position: "asc" } } } });
      const day = (ago: number) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - ago));
      const at = (ago: number, hour: number) => new Date(day(ago).getTime() + hour * 3_600_000);
      await db.enrollment.create({ data: { studentId: leo.id, courseId: finished.id, enrolledAt: at(2, 16), completedAt: at(1, 17), lastLessonId: finished.lessons.at(-1)!.id, lastActivityAt: at(1, 17) } });
      await db.lessonProgress.createMany({
        data: finished.lessons.map((lesson, index) => ({
          studentId: leo.id,
          lessonId: lesson.id,
          status: "completed" as const,
          secondsSpent: 600,
          startedAt: at(index < 2 ? 2 : 1, 16),
          completedAt: at(index < 2 ? 2 : 1, 17),
        })),
      });
      await db.learningDay.createMany({
        data: [
          { studentId: leo.id, day: day(2), secondsSpent: 1200, lessonsCompleted: 2 },
          { studentId: leo.id, day: day(1), secondsSpent: 1200, lessonsCompleted: 2 },
        ],
      });
      await db.certificate.create({
        data: {
          studentId: leo.id,
          courseId: finished.id,
          code: "LUM-DEMO-0001",
          studentName: leo.displayName,
          courseTitle: finished.title,
          subjectName: finished.subject.name,
          gradeLevel: finished.gradeLevel,
          lessonsCount: finished.lessons.length,
          issuedAt: at(1, 17),
        },
      });
      await db.studentBadge.createMany({
        data: ["first-lesson", "first-course"].map((badge) => ({ studentId: leo.id, badge, earnedAt: at(2, 17) })),
        skipDuplicates: true,
      });
    }

    console.log(`
[seed] demo accounts (password: ${DEMO_PASSWORD})
  admin     admin@lumina.test          /sign-in
  teacher   teacher@lumina.test        /sign-in (verified)
  parent    parent@lumina.test         /sign-in (children: Maya, Leo)
  student   leo10                      /sign-in/student (one course finished with its certificate, class work set)
  student   class code ${CLASS_CODE}, "Maya", pictures ${DEMO_PICTURES.join(" → ")}   /sign-in/class
`);
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error("[seed] failed:", error);
  process.exit(1);
});
