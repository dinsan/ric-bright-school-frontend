-- The lesson player (Phase 5): lesson content blocks, video positions, receipts of applied progress reports
-- (safe retries from the offline queue), earned badges, and certificates of completion.

-- AlterTable
ALTER TABLE "lesson_progress" ADD COLUMN     "media_positions" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "content" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "progress_receipts" (
    "student_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_receipts_student_id_report_id_pk" PRIMARY KEY ("student_id","report_id")
);

-- CreateTable
CREATE TABLE "student_badges" (
    "student_id" UUID NOT NULL,
    "badge" VARCHAR(40) NOT NULL,
    "earned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_badges_student_id_badge_pk" PRIMARY KEY ("student_id","badge")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "course_id" UUID,
    "code" VARCHAR(20) NOT NULL,
    "student_name" VARCHAR(80) NOT NULL,
    "course_title" VARCHAR(160) NOT NULL,
    "subject_name" VARCHAR(80) NOT NULL,
    "grade_level" SMALLINT NOT NULL,
    "lessons_count" SMALLINT NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "progress_receipts_received_at_idx" ON "progress_receipts"("received_at");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_code_key" ON "certificates"("code");

-- CreateIndex
CREATE INDEX "certificates_student_issued_idx" ON "certificates"("student_id", "issued_at");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_student_course_key" ON "certificates"("student_id", "course_id");

-- AddForeignKey
ALTER TABLE "progress_receipts" ADD CONSTRAINT "progress_receipts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "student_badges" ADD CONSTRAINT "student_badges_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Not in schema.prisma: CHECK constraints (Prisma leaves them alone once created).
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_content_is_array" CHECK (jsonb_typeof("content") = 'array');
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_media_is_object" CHECK (jsonb_typeof("media_positions") = 'object');
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_grade_level_range" CHECK ("grade_level" BETWEEN 1 AND 12);
