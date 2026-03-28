CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "MeterAssignmentSource" AS ENUM ('ADMIN', 'IMPORT', 'MOBILE_CLAIM', 'SYSTEM');

CREATE TABLE "meter_assignments" (
    "id" UUID NOT NULL,
    "meter_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "assigned_by_id" UUID,
    "ended_by_id" UUID,
    "source" "MeterAssignmentSource" NOT NULL DEFAULT 'ADMIN',
    "notes" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "meter_assignments_pkey" PRIMARY KEY ("id")
);

INSERT INTO "meter_assignments" (
    "id",
    "meter_id",
    "customer_id",
    "source",
    "assigned_at",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    "id",
    "customer_id",
    'SYSTEM'::"MeterAssignmentSource",
    COALESCE("created_at", CURRENT_TIMESTAMP),
    COALESCE("created_at", CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM "meters"
WHERE "deleted_at" IS NULL;

ALTER TABLE "meters" DROP COLUMN "customer_id";

CREATE UNIQUE INDEX "meter_assignments_meter_id_active_key"
ON "meter_assignments"("meter_id")
WHERE "ended_at" IS NULL AND "deleted_at" IS NULL;

CREATE INDEX "meter_assignments_meter_id_assigned_at_idx" ON "meter_assignments"("meter_id", "assigned_at");
CREATE INDEX "meter_assignments_meter_id_ended_at_idx" ON "meter_assignments"("meter_id", "ended_at");
CREATE INDEX "meter_assignments_customer_id_ended_at_idx" ON "meter_assignments"("customer_id", "ended_at");
CREATE INDEX "meter_assignments_assigned_by_id_idx" ON "meter_assignments"("assigned_by_id");
CREATE INDEX "meter_assignments_ended_by_id_idx" ON "meter_assignments"("ended_by_id");
CREATE INDEX "meter_assignments_deleted_at_idx" ON "meter_assignments"("deleted_at");

ALTER TABLE "meter_assignments"
ADD CONSTRAINT "meter_assignments_meter_id_fkey"
FOREIGN KEY ("meter_id") REFERENCES "meters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "meter_assignments"
ADD CONSTRAINT "meter_assignments_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "meter_assignments"
ADD CONSTRAINT "meter_assignments_assigned_by_id_fkey"
FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "meter_assignments"
ADD CONSTRAINT "meter_assignments_ended_by_id_fkey"
FOREIGN KEY ("ended_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
