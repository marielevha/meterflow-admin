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
  'f0f8460d-9d7c-42f7-8d95-ac93f57293ab',
  'meter:import',
  'Import meters',
  'Allows bulk importing meters from CSV through the admin import workflow.',
  'meter',
  'import',
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
  'eaa1767e-d518-4d8d-af00-eea8563785fb',
  r."id",
  p."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  NULL
FROM "roles" r
JOIN "permissions" p ON p."code" = 'meter:import'
WHERE r."code" = 'ADMIN'
ON CONFLICT ("role_id", "permission_id") DO UPDATE SET
  "deleted_at" = NULL,
  "updated_at" = CURRENT_TIMESTAMP;
