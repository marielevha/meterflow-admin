CREATE TABLE "mobile_push_devices" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "expo_push_token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "app_version" TEXT,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "mobile_push_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mobile_push_devices_expo_push_token_key"
  ON "mobile_push_devices"("expo_push_token");

CREATE INDEX "mobile_push_devices_user_id_deleted_at_idx"
  ON "mobile_push_devices"("user_id", "deleted_at");

CREATE INDEX "mobile_push_devices_deleted_at_last_seen_at_idx"
  ON "mobile_push_devices"("deleted_at", "last_seen_at");

ALTER TABLE "mobile_push_devices"
  ADD CONSTRAINT "mobile_push_devices_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
