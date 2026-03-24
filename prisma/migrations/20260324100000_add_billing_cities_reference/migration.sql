-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "zones" ADD COLUMN "city_id" UUID;

-- AlterTable
ALTER TABLE "billing_campaign_zones"
ADD COLUMN "city_name_snapshot" TEXT,
ADD COLUMN "zone_name_snapshot" TEXT;

-- Backfill cities from existing zones
WITH distinct_cities AS (
    SELECT DISTINCT
        trim(z."city") AS "name",
        NULLIF(trim(z."region"), '') AS "region",
        'CG-CITY-' || upper(
            regexp_replace(
                coalesce(NULLIF(trim(z."region"), '') || '-', '') || trim(z."city"),
                '[^A-Za-z0-9]+',
                '-',
                'g'
            )
        ) AS "code",
        (
            substr(md5(lower(trim(z."city")) || '|' || lower(coalesce(trim(z."region"), ''))), 1, 8) || '-' ||
            substr(md5(lower(trim(z."city")) || '|' || lower(coalesce(trim(z."region"), ''))), 9, 4) || '-' ||
            substr(md5(lower(trim(z."city")) || '|' || lower(coalesce(trim(z."region"), ''))), 13, 4) || '-' ||
            substr(md5(lower(trim(z."city")) || '|' || lower(coalesce(trim(z."region"), ''))), 17, 4) || '-' ||
            substr(md5(lower(trim(z."city")) || '|' || lower(coalesce(trim(z."region"), ''))), 21, 12)
        )::uuid AS "id"
    FROM "zones" z
    WHERE z."city" IS NOT NULL
      AND trim(z."city") <> ''
)
INSERT INTO "cities" ("id", "code", "name", "region", "is_active", "created_at", "updated_at")
SELECT "id", "code", "name", "region", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM distinct_cities;

-- Backfill zone city relation
UPDATE "zones" z
SET "city_id" = c."id"
FROM "cities" c
WHERE lower(trim(z."city")) = lower(c."name")
  AND lower(coalesce(trim(z."region"), '')) = lower(coalesce(c."region", ''));

-- Backfill campaign zone snapshots
UPDATE "billing_campaign_zones" bcz
SET "city_name_snapshot" = c."name",
    "zone_name_snapshot" = z."name"
FROM "zones" z
JOIN "cities" c ON c."id" = z."city_id"
WHERE bcz."zone_id" = z."id";

-- Enforce city relation
ALTER TABLE "zones" ALTER COLUMN "city_id" SET NOT NULL;

-- Cleanup old zone text columns
ALTER TABLE "zones" DROP COLUMN "city",
DROP COLUMN "region";

-- CreateIndex
CREATE UNIQUE INDEX "cities_code_key" ON "cities"("code");

-- CreateIndex
CREATE INDEX "cities_name_idx" ON "cities"("name");

-- CreateIndex
CREATE INDEX "cities_is_active_idx" ON "cities"("is_active");

-- CreateIndex
CREATE INDEX "cities_deleted_at_idx" ON "cities"("deleted_at");

-- CreateIndex
CREATE INDEX "zones_city_id_name_idx" ON "zones"("city_id", "name");

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
