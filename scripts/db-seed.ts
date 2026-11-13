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

type CourseSeed = { slug: string; title: string; subject: string; grade: number; summary: string; description?: string };

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
  { slug: "ratios-and-rates", title: "Ratios and Rates", subject: "mathematics", grade: 6, summary: "Ratio language, unit rates and tables for solving real problems." },
  { slug: "cells-the-building-blocks-of-life", title: "Cells: the Building Blocks of Life", subject: "science", grade: 6, summary: "Plant and animal cells, microscopes and what each part does." },
  { slug: "spanish-for-beginners", title: "Spanish for Beginners", subject: "languages", grade: 6, summary: "Greetings, numbers, family and everyday phrases." },
  { slug: "pre-algebra", title: "Pre-Algebra", subject: "mathematics", grade: 7, summary: "Expressions, equations and inequalities with one variable." },
  { slug: "world-climates", title: "World Climates", subject: "geography", grade: 7, summary: "Climate zones, weather patterns and how climate shapes how people live." },
  { slug: "introduction-to-python", title: "Introduction to Python", subject: "computing", grade: 8, summary: "Variables, conditions, loops and functions: write your first real programs." },
  { slug: "chemistry-basics", title: "Chemistry Basics", subject: "science", grade: 8, summary: "Atoms, elements, the periodic table and simple reactions." },
  { slug: "algebra-1", title: "Algebra 1", subject: "mathematics", grade: 9, summary: "Linear equations, functions, systems and an introduction to quadratics." },
  { slug: "the-industrial-revolution", title: "The Industrial Revolution", subject: "history", grade: 9, summary: "Machines, cities and workers: how industry changed everyday life." },
  { slug: "geometry", title: "Geometry", subject: "mathematics", grade: 10, summary: "Proof, congruence, similarity, circles and coordinate geometry." },
  { slug: "biology-genetics", title: "Biology: Genetics", subject: "science", grade: 10, summary: "DNA, inheritance, variation and how traits pass between generations." },
  { slug: "drawing-from-observation", title: "Drawing from Observation", subject: "art-design", grade: 10, summary: "Line, tone, proportion and perspective, drawing what you see." },
  { slug: "precalculus", title: "Precalculus", subject: "mathematics", grade: 11, summary: "Functions, trigonometry, sequences and limits: ready for calculus." },
  { slug: "data-structures-and-algorithms", title: "Data Structures and Algorithms", subject: "computing", grade: 11, summary: "Lists, trees, searching and sorting, and how to reason about speed." },
  { slug: "calculus", title: "Calculus", subject: "mathematics", grade: 12, summary: "Derivatives, integrals and their applications." },
  { slug: "physics-mechanics", title: "Physics: Mechanics", subject: "science", grade: 12, summary: "Motion, forces, energy and momentum with real-world problems." },
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
        publishedAt: course.status === "published" ? published : null,
      })),
      skipDuplicates: true,
    });
    const courseIds = new Map((await db.course.findMany({ select: { id: true, slug: true } })).map((row) => [row.slug, row.id]));
    const lessonRows = Object.entries(LESSONS).flatMap(([courseSlug, items]) =>
      items.map(([title, summary, minutes], index) => ({
        courseId: courseIds.get(courseSlug)!,
        slug: lessonSlug(title),
        title,
        summary,
        position: index + 1,
        durationMinutes: minutes,
      })),
    );
    await db.lesson.createMany({ data: lessonRows, skipDuplicates: true });
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

    console.log(`
[seed] demo accounts (password: ${DEMO_PASSWORD})
  admin     admin@lumina.test          /sign-in
  teacher   teacher@lumina.test        /sign-in (verified)
  parent    parent@lumina.test         /sign-in (children: Maya, Leo)
  student   leo10                      /sign-in/student
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
