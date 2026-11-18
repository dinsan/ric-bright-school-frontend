-- Quizzes (FE-ASM-01, FE-ASM-02): quizzes in courses (questions as JSON, validated when read by
-- src/features/learn/quiz.ts) and students' attempts (answers, flags, the mark). Only new tables: the previous
-- version of the app keeps working while this runs.

-- CreateEnum
CREATE TYPE "quiz_attempt_status" AS ENUM ('in_progress', 'submitted');

-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(1000),
    "position" SMALLINT NOT NULL DEFAULT 1,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "questions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
    "status" "quiz_attempt_status" NOT NULL DEFAULT 'in_progress',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "flagged" JSONB NOT NULL DEFAULT '[]',
    "results" JSONB,
    "score" SMALLINT,
    "max_score" SMALLINT,
    "pending_review" SMALLINT NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ(6),

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quizzes_course_position_idx" ON "quizzes"("course_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_course_slug_key" ON "quizzes"("course_id", "slug");

-- CreateIndex
CREATE INDEX "quiz_attempts_student_quiz_started_idx" ON "quiz_attempts"("student_id", "quiz_id", "started_at");

-- CreateIndex
CREATE INDEX "quiz_attempts_quiz_idx" ON "quiz_attempts"("quiz_id");

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Not in schema.prisma: CHECK constraints (Prisma leaves them alone once created).
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_position_positive" CHECK ("position" > 0);
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_scores_not_negative" CHECK ("score" >= 0 AND "max_score" >= 0 AND "pending_review" >= 0);
