CREATE TABLE IF NOT EXISTS "mobile_notification_reads" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "reading_event_id" UUID NOT NULL,
  "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mobile_notification_reads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mobile_notification_reads_user_id_reading_event_id_key"
  ON "mobile_notification_reads"("user_id", "reading_event_id");

CREATE INDEX IF NOT EXISTS "mobile_notification_reads_user_id_read_at_idx"
  ON "mobile_notification_reads"("user_id", "read_at");

CREATE INDEX IF NOT EXISTS "mobile_notification_reads_reading_event_id_idx"
  ON "mobile_notification_reads"("reading_event_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'mobile_notification_reads_user_id_fkey'
      AND table_name = 'mobile_notification_reads'
  ) THEN
    ALTER TABLE "mobile_notification_reads"
      ADD CONSTRAINT "mobile_notification_reads_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'mobile_notification_reads_reading_event_id_fkey'
      AND table_name = 'mobile_notification_reads'
  ) THEN
    ALTER TABLE "mobile_notification_reads"
      ADD CONSTRAINT "mobile_notification_reads_reading_event_id_fkey"
      FOREIGN KEY ("reading_event_id") REFERENCES "reading_events"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
