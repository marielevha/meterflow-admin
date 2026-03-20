CREATE TYPE "TaskResolutionCode" AS ENUM (
  'READING_CONFIRMED',
  'READING_IMPOSSIBLE',
  'METER_INACCESSIBLE',
  'METER_DAMAGED_OR_MISSING',
  'SUSPECTED_FRAUD',
  'CUSTOMER_ABSENT',
  'ESCALATION_REQUIRED'
);

ALTER TABLE "tasks"
  ADD COLUMN "reported_reading_id" UUID,
  ADD COLUMN "started_by_id" UUID,
  ADD COLUMN "resolution_code" "TaskResolutionCode",
  ADD COLUMN "resolution_comment" TEXT,
  ADD COLUMN "started_at" TIMESTAMP(3),
  ADD COLUMN "field_submitted_at" TIMESTAMP(3),
  ADD COLUMN "field_primary_index" DECIMAL(14,3),
  ADD COLUMN "field_secondary_index" DECIMAL(14,3),
  ADD COLUMN "field_image_url" TEXT,
  ADD COLUMN "field_image_hash" TEXT,
  ADD COLUMN "field_image_mime_type" TEXT,
  ADD COLUMN "field_image_size_bytes" INTEGER,
  ADD COLUMN "field_gps_latitude" DECIMAL(10,7),
  ADD COLUMN "field_gps_longitude" DECIMAL(10,7),
  ADD COLUMN "field_gps_accuracy_meters" DECIMAL(10,2);

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_reported_reading_id_fkey"
    FOREIGN KEY ("reported_reading_id") REFERENCES "readings"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "tasks_started_by_id_fkey"
    FOREIGN KEY ("started_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tasks_started_by_id_idx" ON "tasks"("started_by_id");
CREATE INDEX "tasks_reported_reading_id_idx" ON "tasks"("reported_reading_id");
CREATE INDEX "tasks_resolution_code_idx" ON "tasks"("resolution_code");
