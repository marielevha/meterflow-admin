-- CreateEnum
CREATE TYPE "TariffBillingMode" AS ENUM ('SINGLE_RATE', 'TIME_OF_USE');

-- CreateEnum
CREATE TYPE "TaxRuleType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "TaxApplicationScope" AS ENUM ('CONSUMPTION', 'FIXED_CHARGE', 'SUBTOTAL');

-- CreateTable
CREATE TABLE "zones" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rules" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "zone_id" UUID,
    "type" "TaxRuleType" NOT NULL,
    "application_scope" "TaxApplicationScope" NOT NULL,
    "value" DECIMAL(14,3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tax_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariff_plan_taxes" (
    "id" UUID NOT NULL,
    "tariff_plan_id" UUID NOT NULL,
    "tax_rule_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tariff_plan_taxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_campaign_zones" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "billing_campaign_zones_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "meters"
ADD COLUMN "zone_id" UUID;

-- AlterTable
ALTER TABLE "tariff_plans"
ADD COLUMN "zone_id" UUID,
ADD COLUMN "billing_mode" "TariffBillingMode" NOT NULL DEFAULT 'SINGLE_RATE',
ADD COLUMN "single_unit_price" DECIMAL(14,3),
ADD COLUMN "hp_unit_price" DECIMAL(14,3),
ADD COLUMN "hc_unit_price" DECIMAL(14,3),
ADD COLUMN "effective_from" TIMESTAMP(3),
ADD COLUMN "effective_to" TIMESTAMP(3);

-- Backfill
UPDATE "tariff_plans" tp
SET "single_unit_price" = COALESCE(
  (
    SELECT tt."unit_price"
    FROM "tariff_tiers" tt
    WHERE tt."tariff_plan_id" = tp."id"
      AND tt."deleted_at" IS NULL
    ORDER BY tt."min_consumption" ASC
    LIMIT 1
  ),
  0
)
WHERE "single_unit_price" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "zones_code_key" ON "zones"("code");

-- CreateIndex
CREATE INDEX "zones_city_name_idx" ON "zones"("city", "name");

-- CreateIndex
CREATE INDEX "zones_is_active_idx" ON "zones"("is_active");

-- CreateIndex
CREATE INDEX "zones_deleted_at_idx" ON "zones"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rules_code_key" ON "tax_rules"("code");

-- CreateIndex
CREATE INDEX "tax_rules_zone_id_is_active_idx" ON "tax_rules"("zone_id", "is_active");

-- CreateIndex
CREATE INDEX "tax_rules_effective_from_effective_to_idx" ON "tax_rules"("effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "tax_rules_deleted_at_idx" ON "tax_rules"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "tariff_plan_taxes_tariff_plan_id_tax_rule_id_key" ON "tariff_plan_taxes"("tariff_plan_id", "tax_rule_id");

-- CreateIndex
CREATE INDEX "tariff_plan_taxes_tariff_plan_id_sort_order_idx" ON "tariff_plan_taxes"("tariff_plan_id", "sort_order");

-- CreateIndex
CREATE INDEX "tariff_plan_taxes_tax_rule_id_idx" ON "tariff_plan_taxes"("tax_rule_id");

-- CreateIndex
CREATE INDEX "tariff_plan_taxes_deleted_at_idx" ON "tariff_plan_taxes"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "billing_campaign_zones_campaign_id_zone_id_key" ON "billing_campaign_zones"("campaign_id", "zone_id");

-- CreateIndex
CREATE INDEX "billing_campaign_zones_campaign_id_idx" ON "billing_campaign_zones"("campaign_id");

-- CreateIndex
CREATE INDEX "billing_campaign_zones_zone_id_idx" ON "billing_campaign_zones"("zone_id");

-- CreateIndex
CREATE INDEX "billing_campaign_zones_deleted_at_idx" ON "billing_campaign_zones"("deleted_at");

-- CreateIndex
CREATE INDEX "meters_zone_id_idx" ON "meters"("zone_id");

-- CreateIndex
CREATE INDEX "tariff_plans_zone_id_billing_mode_idx" ON "tariff_plans"("zone_id", "billing_mode");

-- CreateIndex
CREATE INDEX "tariff_plans_effective_from_effective_to_idx" ON "tariff_plans"("effective_from", "effective_to");

-- AddForeignKey
ALTER TABLE "meters" ADD CONSTRAINT "meters_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariff_plans" ADD CONSTRAINT "tariff_plans_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariff_plan_taxes" ADD CONSTRAINT "tariff_plan_taxes_tariff_plan_id_fkey" FOREIGN KEY ("tariff_plan_id") REFERENCES "tariff_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariff_plan_taxes" ADD CONSTRAINT "tariff_plan_taxes_tax_rule_id_fkey" FOREIGN KEY ("tax_rule_id") REFERENCES "tax_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_campaign_zones" ADD CONSTRAINT "billing_campaign_zones_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "billing_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_campaign_zones" ADD CONSTRAINT "billing_campaign_zones_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
