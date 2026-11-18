-- Parental controls (FE-PAR-03): a daily learning-time limit and a bedtime per child, and whether reaching
-- them reminds the child or pauses lessons and quizzes. One new table: the previous version keeps working.

-- CreateEnum
CREATE TYPE "control_action" AS ENUM ('remind', 'pause');

-- CreateTable
CREATE TABLE "parental_controls" (
    "child_id" UUID NOT NULL,
    "daily_minutes" SMALLINT,
    "bedtime_start" VARCHAR(5),
    "bedtime_end" VARCHAR(5),
    "when_reached" "control_action" NOT NULL DEFAULT 'remind',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" UUID,

    CONSTRAINT "parental_controls_pkey" PRIMARY KEY ("child_id")
);

-- AddForeignKey
ALTER TABLE "parental_controls" ADD CONSTRAINT "parental_controls_child_id_users_id_fk" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "parental_controls" ADD CONSTRAINT "parental_controls_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Not in schema.prisma: CHECK constraints (Prisma leaves them alone once created).
ALTER TABLE "parental_controls" ADD CONSTRAINT "parental_controls_daily_minutes_range" CHECK ("daily_minutes" BETWEEN 5 AND 600);
ALTER TABLE "parental_controls" ADD CONSTRAINT "parental_controls_bedtime_format" CHECK ("bedtime_start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "bedtime_end" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "parental_controls" ADD CONSTRAINT "parental_controls_bedtime_both" CHECK (("bedtime_start" IS NULL) = ("bedtime_end" IS NULL));
