-- Learning paths (course prerequisites), assignments set by teachers for a class, and spaced review items.

-- CreateTable
CREATE TABLE "course_prerequisites" (
    "course_id" UUID NOT NULL,
    "requires_course_id" UUID NOT NULL,

    CONSTRAINT "course_prerequisites_course_id_requires_course_id_pk" PRIMARY KEY ("course_id","requires_course_id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "lesson_id" UUID,
    "title" VARCHAR(160) NOT NULL,
    "instructions" VARCHAR(1000),
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "block_id" VARCHAR(40) NOT NULL,
    "box" SMALLINT NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "last_reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_prerequisites_requires_idx" ON "course_prerequisites"("requires_course_id");

-- CreateIndex
CREATE INDEX "assignments_class_due_idx" ON "assignments"("class_id", "due_at");

-- CreateIndex
CREATE INDEX "review_items_student_due_idx" ON "review_items"("student_id", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "review_items_student_lesson_block_key" ON "review_items"("student_id", "lesson_id", "block_id");

-- AddForeignKey
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_requires_course_id_courses_id_fk" FOREIGN KEY ("requires_course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Not in schema.prisma: CHECK constraints (Prisma leaves them alone once created).
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_not_itself" CHECK ("course_id" <> "requires_course_id");
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_box_range" CHECK ("box" BETWEEN 0 AND 6);
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_counts_not_negative" CHECK ("reps" >= 0 AND "lapses" >= 0);
