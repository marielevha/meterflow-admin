CREATE TYPE "TaskEventType" AS ENUM (
  'ASSIGNED',
  'STARTED',
  'BLOCKED',
  'COMPLETED',
  'FIELD_RESULT_SUBMITTED'
);

CREATE TABLE "task_events" (
  "id" UUID NOT NULL,
  "task_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "recipient_user_id" UUID NOT NULL,
  "type" "TaskEventType" NOT NULL,
  "payload" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "task_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_notification_reads" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "task_event_id" UUID NOT NULL,
  "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_notification_reads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_notification_reads_user_id_task_event_id_key"
  ON "agent_notification_reads"("user_id", "task_event_id");

CREATE INDEX "task_events_task_id_created_at_idx"
  ON "task_events"("task_id", "created_at");

CREATE INDEX "task_events_recipient_user_id_created_at_idx"
  ON "task_events"("recipient_user_id", "created_at");

CREATE INDEX "task_events_actor_user_id_idx"
  ON "task_events"("actor_user_id");

CREATE INDEX "task_events_deleted_at_idx"
  ON "task_events"("deleted_at");

CREATE INDEX "agent_notification_reads_user_id_read_at_idx"
  ON "agent_notification_reads"("user_id", "read_at");

CREATE INDEX "agent_notification_reads_task_event_id_idx"
  ON "agent_notification_reads"("task_event_id");

ALTER TABLE "task_events"
  ADD CONSTRAINT "task_events_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "tasks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "task_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "task_events_recipient_user_id_fkey"
    FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_notification_reads"
  ADD CONSTRAINT "agent_notification_reads_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "agent_notification_reads_task_event_id_fkey"
    FOREIGN KEY ("task_event_id") REFERENCES "task_events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
