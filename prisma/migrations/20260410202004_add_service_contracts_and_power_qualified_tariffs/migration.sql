-- CreateEnum
CREATE TYPE "ServiceUsageCategory" AS ENUM ('RESIDENTIAL', 'PROFESSIONAL', 'ADMINISTRATION', 'INDUSTRIAL', 'PUBLIC_LIGHTING');

-- CreateEnum
CREATE TYPE "ServicePowerUnit" AS ENUM ('AMPERE', 'KVA');

-- CreateEnum
CREATE TYPE "ServicePhaseType" AS ENUM ('SINGLE_PHASE', 'THREE_PHASE');

-- CreateEnum
CREATE TYPE "ServiceContractSource" AS ENUM ('ADMIN', 'IMPORT', 'SYSTEM');

-- DropForeignKey
ALTER TABLE "agent_notification_reads" DROP CONSTRAINT "agent_notification_reads_task_event_id_fkey";

-- DropForeignKey
ALTER TABLE "agent_notification_reads" DROP CONSTRAINT "agent_notification_reads_user_id_fkey";

-- DropForeignKey
ALTER TABLE "task_events" DROP CONSTRAINT "task_events_recipient_user_id_fkey";

-- DropForeignKey
ALTER TABLE "task_events" DROP CONSTRAINT "task_events_task_id_fkey";

-- DropIndex
DROP INDEX "tariff_plans_zone_id_billing_mode_idx";

-- AlterTable
ALTER TABLE "agent_notification_reads" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "billing_mode_snapshot" "TariffBillingMode",
ADD COLUMN     "contract_number_snapshot" TEXT,
ADD COLUMN     "phase_type_snapshot" "ServicePhaseType",
ADD COLUMN     "police_number_snapshot" TEXT,
ADD COLUMN     "service_contract_id" UUID,
ADD COLUMN     "subscribed_power_unit_snapshot" "ServicePowerUnit",
ADD COLUMN     "subscribed_power_value_snapshot" DECIMAL(10,3),
ADD COLUMN     "usage_category_snapshot" "ServiceUsageCategory";

-- AlterTable
ALTER TABLE "tariff_plans" ADD COLUMN     "phase_type" "ServicePhaseType",
ADD COLUMN     "subscribed_power_max" DECIMAL(10,3),
ADD COLUMN     "subscribed_power_min" DECIMAL(10,3),
ADD COLUMN     "subscribed_power_unit" "ServicePowerUnit" NOT NULL DEFAULT 'AMPERE',
ADD COLUMN     "usage_category" "ServiceUsageCategory" NOT NULL DEFAULT 'RESIDENTIAL';

-- AlterTable
ALTER TABLE "task_events" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "service_contracts" (
    "id" UUID NOT NULL,
    "meter_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "created_by_id" UUID,
    "ended_by_id" UUID,
    "contract_number" TEXT,
    "police_number" TEXT,
    "usage_category" "ServiceUsageCategory" NOT NULL,
    "billing_mode" "TariffBillingMode" NOT NULL,
    "subscribed_power_value" DECIMAL(10,3) NOT NULL,
    "subscribed_power_unit" "ServicePowerUnit" NOT NULL DEFAULT 'AMPERE',
    "phase_type" "ServicePhaseType" NOT NULL DEFAULT 'SINGLE_PHASE',
    "source" "ServiceContractSource" NOT NULL DEFAULT 'ADMIN',
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "service_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_contracts_contract_number_key" ON "service_contracts"("contract_number");

-- CreateIndex
CREATE UNIQUE INDEX "service_contracts_police_number_key" ON "service_contracts"("police_number");

-- CreateIndex
CREATE INDEX "service_contracts_meter_id_effective_from_effective_to_idx" ON "service_contracts"("meter_id", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "service_contracts_customer_id_effective_from_effective_to_idx" ON "service_contracts"("customer_id", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "service_contracts_billing_mode_usage_category_subscribed_po_idx" ON "service_contracts"("billing_mode", "usage_category", "subscribed_power_unit", "phase_type");

-- CreateIndex
CREATE INDEX "service_contracts_deleted_at_idx" ON "service_contracts"("deleted_at");

-- CreateIndex
CREATE INDEX "invoices_service_contract_id_idx" ON "invoices"("service_contract_id");

-- CreateIndex
CREATE INDEX "tariff_plans_zone_id_usage_category_billing_mode_subscribed_idx" ON "tariff_plans"("zone_id", "usage_category", "billing_mode", "subscribed_power_unit", "phase_type");

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "meters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_ended_by_id_fkey" FOREIGN KEY ("ended_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_service_contract_id_fkey" FOREIGN KEY ("service_contract_id") REFERENCES "service_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_notification_reads" ADD CONSTRAINT "agent_notification_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_notification_reads" ADD CONSTRAINT "agent_notification_reads_task_event_id_fkey" FOREIGN KEY ("task_event_id") REFERENCES "task_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
