-- Repair billing schema drift for databases that have billing tables
-- but miss columns introduced by later schema updates.

ALTER TABLE "billing_campaigns"
  ADD COLUMN IF NOT EXISTS "submission_start_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "submission_end_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cutoff_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "launched_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "generated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "issued_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "finalized_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "settings_snapshot" JSONB;

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "from_reading_id" UUID,
  ADD COLUMN IF NOT EXISTS "to_reading_id" UUID,
  ADD COLUMN IF NOT EXISTS "from_primary_index" DECIMAL(14,3),
  ADD COLUMN IF NOT EXISTS "to_primary_index" DECIMAL(14,3),
  ADD COLUMN IF NOT EXISTS "from_secondary_index" DECIMAL(14,3),
  ADD COLUMN IF NOT EXISTS "to_secondary_index" DECIMAL(14,3),
  ADD COLUMN IF NOT EXISTS "previous_primary" DECIMAL(14,3),
  ADD COLUMN IF NOT EXISTS "current_primary" DECIMAL(14,3),
  ADD COLUMN IF NOT EXISTS "previous_secondary" DECIMAL(14,3),
  ADD COLUMN IF NOT EXISTS "current_secondary" DECIMAL(14,3),
  ADD COLUMN IF NOT EXISTS "consumption_primary" DECIMAL(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "consumption_secondary" DECIMAL(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "is_estimated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "estimation_method" TEXT,
  ADD COLUMN IF NOT EXISTS "has_exception" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "cycle_finalized_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "billing_campaigns_deleted_at_idx"
ON "billing_campaigns"("deleted_at");

CREATE INDEX IF NOT EXISTS "invoices_from_reading_id_idx"
ON "invoices"("from_reading_id");

CREATE INDEX IF NOT EXISTS "invoices_to_reading_id_idx"
ON "invoices"("to_reading_id");

CREATE INDEX IF NOT EXISTS "invoices_deleted_at_idx"
ON "invoices"("deleted_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoices_from_reading_id_fkey'
  ) THEN
    ALTER TABLE "invoices"
      ADD CONSTRAINT "invoices_from_reading_id_fkey"
      FOREIGN KEY ("from_reading_id") REFERENCES "readings"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoices_to_reading_id_fkey'
  ) THEN
    ALTER TABLE "invoices"
      ADD CONSTRAINT "invoices_to_reading_id_fkey"
      FOREIGN KEY ("to_reading_id") REFERENCES "readings"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
