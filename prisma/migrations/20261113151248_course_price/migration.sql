-- What a course costs, in cents (0 = free). Admins set it on /admin/courses. The currency is
-- site-wide (COURSE_CURRENCY in src/lib/format.ts).
-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "price_cents" INTEGER NOT NULL DEFAULT 0;

-- Not in schema.prisma: CHECK constraint (Prisma leaves it alone once created).
ALTER TABLE "courses" ADD CONSTRAINT "courses_price_cents_not_negative" CHECK ("price_cents" >= 0);
