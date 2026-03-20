-- Performance indexes for frequent admin filters and timelines
CREATE INDEX IF NOT EXISTS "meter_states_deleted_at_effective_at_idx"
ON "meter_states" ("deleted_at", "effective_at");

CREATE INDEX IF NOT EXISTS "readings_deleted_at_created_at_idx"
ON "readings" ("deleted_at", "created_at");

CREATE INDEX IF NOT EXISTS "readings_deleted_at_status_created_at_idx"
ON "readings" ("deleted_at", "status", "created_at");

CREATE INDEX IF NOT EXISTS "reading_events_deleted_at_created_at_idx"
ON "reading_events" ("deleted_at", "created_at");

CREATE INDEX IF NOT EXISTS "tasks_deleted_at_created_at_idx"
ON "tasks" ("deleted_at", "created_at");
