-- Student learning data (Phase 5 foundations): enrolments, lesson progress, and learning activity per day.
-- Day-level aggregates on purpose, so no event stream about children is stored (see schema.prisma).

-- CreateEnum
CREATE TYPE "lesson_progress_status" AS ENUM ('started', 'completed');

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "last_lesson_id" UUID,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "student_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "status" "lesson_progress_status" NOT NULL DEFAULT 'started',
    "seconds_spent" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_progress_student_id_lesson_id_pk" PRIMARY KEY ("student_id","lesson_id")
);

-- CreateTable
CREATE TABLE "learning_days" (
    "student_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "seconds_spent" INTEGER NOT NULL DEFAULT 0,
    "lessons_completed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "learning_days_student_id_day_pk" PRIMARY KEY ("student_id","day")
);

-- CreateIndex
CREATE INDEX "enrollments_student_activity_idx" ON "enrollments"("student_id", "last_activity_at");

-- CreateIndex
CREATE INDEX "enrollments_course_idx" ON "enrollments"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_student_course_key" ON "enrollments"("student_id", "course_id");

-- CreateIndex
CREATE INDEX "lesson_progress_lesson_idx" ON "lesson_progress"("lesson_id");

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "learning_days" ADD CONSTRAINT "learning_days_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Not in schema.prisma: CHECK constraints (Prisma leaves them alone once created).
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_seconds_not_negative" CHECK ("seconds_spent" >= 0);
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_completed_has_time" CHECK (("status" = 'completed') = ("completed_at" IS NOT NULL));
ALTER TABLE "learning_days" ADD CONSTRAINT "learning_days_counts_not_negative" CHECK ("seconds_spent" >= 0 AND "lessons_completed" >= 0);
