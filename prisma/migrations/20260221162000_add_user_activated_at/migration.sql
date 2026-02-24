-- AlterTable
ALTER TABLE "users" ADD COLUMN "activated_at" TIMESTAMP(3);

-- Backfill existing active users
UPDATE "users"
SET "activated_at" = NOW()
WHERE "status" = 'ACTIVE' AND "activated_at" IS NULL;
