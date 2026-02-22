CREATE TABLE "app_settings" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");
CREATE INDEX "app_settings_deleted_at_idx" ON "app_settings"("deleted_at");
