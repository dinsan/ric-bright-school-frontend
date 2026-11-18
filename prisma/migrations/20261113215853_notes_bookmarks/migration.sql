-- Notes and bookmarks inside lessons (FE-STU-06): private to the student.

-- CreateTable
CREATE TABLE "lesson_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "block_id" VARCHAR(40),
    "body" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_bookmarks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "anchor" VARCHAR(80) NOT NULL,
    "block_id" VARCHAR(40),
    "media_seconds" INTEGER,
    "label" VARCHAR(120),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_notes_student_updated_idx" ON "lesson_notes"("student_id", "updated_at");

-- CreateIndex
CREATE INDEX "lesson_notes_student_lesson_idx" ON "lesson_notes"("student_id", "lesson_id");

-- CreateIndex
CREATE INDEX "lesson_bookmarks_student_created_idx" ON "lesson_bookmarks"("student_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_bookmarks_student_lesson_anchor_key" ON "lesson_bookmarks"("student_id", "lesson_id", "anchor");

-- AddForeignKey
ALTER TABLE "lesson_notes" ADD CONSTRAINT "lesson_notes_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lesson_notes" ADD CONSTRAINT "lesson_notes_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lesson_bookmarks" ADD CONSTRAINT "lesson_bookmarks_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lesson_bookmarks" ADD CONSTRAINT "lesson_bookmarks_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Not in schema.prisma: CHECK constraints (Prisma leaves them alone once created).
ALTER TABLE "lesson_notes" ADD CONSTRAINT "lesson_notes_body_not_blank" CHECK (length(btrim("body")) > 0);
ALTER TABLE "lesson_bookmarks" ADD CONSTRAINT "lesson_bookmarks_media_seconds_range" CHECK ("media_seconds" IS NULL OR "media_seconds" >= 0);
