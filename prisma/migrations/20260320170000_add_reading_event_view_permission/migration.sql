INSERT INTO "permissions" (
  "id",
  "code",
  "name",
  "description",
  "resource",
  "action",
  "created_at",
  "updated_at",
  "deleted_at"
)
VALUES (
  'f2b95f52-73b9-4e44-bf75-5d1d3b3721e0',
  'reading-event:view',
  'View reading event audit trail',
  'Allows viewing the reading events audit trail block and endpoint.',
  'reading_event',
  'view',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  NULL
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "resource" = EXCLUDED."resource",
  "action" = EXCLUDED."action",
  "deleted_at" = NULL,
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" (
  "id",
  "role_id",
  "permission_id",
  "created_at",
  "updated_at",
  "deleted_at"
)
SELECT
  'a96c933e-5480-4dd0-a2e4-269ee1703340',
  r."id",
  p."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  NULL
FROM "roles" r
JOIN "permissions" p ON p."code" = 'reading-event:view'
WHERE r."code" = 'SUPERVISOR'
ON CONFLICT ("role_id", "permission_id") DO UPDATE SET
  "deleted_at" = NULL,
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" (
  "id",
  "role_id",
  "permission_id",
  "created_at",
  "updated_at",
  "deleted_at"
)
SELECT
  'c93c7550-bf6b-451d-b2cf-aef214ecf2b8',
  r."id",
  p."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  NULL
FROM "roles" r
JOIN "permissions" p ON p."code" = 'reading-event:view'
WHERE r."code" = 'ADMIN'
ON CONFLICT ("role_id", "permission_id") DO UPDATE SET
  "deleted_at" = NULL,
  "updated_at" = CURRENT_TIMESTAMP;
