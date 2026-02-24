-- CreateEnum
CREATE TYPE "BillingCampaignStatus" AS ENUM ('DRAFT', 'READY', 'RUNNING', 'GENERATED', 'ISSUED', 'CLOSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ISSUED', 'DELIVERED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "InvoiceLineType" AS ENUM ('CONSUMPTION', 'FIXED_FEE', 'TAX', 'ADJUSTMENT', 'PENALTY');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('SMS', 'EMAIL', 'PORTAL', 'PRINT');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('SMS', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "tariff_plans" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "fixed_charge" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "late_fee_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tariff_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariff_tiers" (
    "id" UUID NOT NULL,
    "tariff_plan_id" UUID NOT NULL,
    "min_consumption" DECIMAL(14,3) NOT NULL,
    "max_consumption" DECIMAL(14,3),
    "unit_price" DECIMAL(14,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tariff_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_campaigns" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "submission_start_at" TIMESTAMP(3),
    "submission_end_at" TIMESTAMP(3),
    "cutoff_at" TIMESTAMP(3),
    "frequency" TEXT NOT NULL,
    "city" TEXT,
    "zone" TEXT,
    "status" "BillingCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "tariff_plan_id" UUID,
    "created_by_id" UUID,
    "launched_at" TIMESTAMP(3),
    "generated_at" TIMESTAMP(3),
    "issued_at" TIMESTAMP(3),
    "finalized_at" TIMESTAMP(3),
    "notes" TEXT,
    "settings_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "billing_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "campaign_id" UUID,
    "tariff_plan_id" UUID,
    "customer_id" UUID NOT NULL,
    "meter_id" UUID NOT NULL,
    "source_reading_id" UUID,
    "from_reading_id" UUID,
    "to_reading_id" UUID,
    "generated_by_id" UUID,
    "approved_by_id" UUID,
    "canceled_by_id" UUID,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "from_primary_index" DECIMAL(14,3),
    "to_primary_index" DECIMAL(14,3),
    "from_secondary_index" DECIMAL(14,3),
    "to_secondary_index" DECIMAL(14,3),
    "previous_primary" DECIMAL(14,3),
    "current_primary" DECIMAL(14,3),
    "previous_secondary" DECIMAL(14,3),
    "current_secondary" DECIMAL(14,3),
    "consumption_primary" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "consumption_secondary" DECIMAL(14,3) DEFAULT 0,
    "is_estimated" BOOLEAN NOT NULL DEFAULT false,
    "estimation_method" TEXT,
    "has_exception" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fixed_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adjustment_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "issued_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "cycle_finalized_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "type" "InvoiceLineType" NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "meta" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_events" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "user_id" UUID,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "invoice_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "received_by_id" UUID,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_deliveries" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider_message_id" TEXT,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "triggered_by_id" UUID,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "invoice_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_reminder_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "status" "ReminderStatus" NOT NULL,
    "reminder_window_key" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "pending_meters" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "provider_message_id" TEXT,
    "payload" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reading_reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tariff_plans_code_key" ON "tariff_plans"("code");
CREATE INDEX "tariff_plans_is_active_is_default_idx" ON "tariff_plans"("is_active", "is_default");
CREATE INDEX "tariff_plans_deleted_at_idx" ON "tariff_plans"("deleted_at");

-- CreateIndex
CREATE INDEX "tariff_tiers_tariff_plan_id_min_consumption_max_consumption_idx" ON "tariff_tiers"("tariff_plan_id", "min_consumption", "max_consumption");
CREATE INDEX "tariff_tiers_deleted_at_idx" ON "tariff_tiers"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "billing_campaigns_code_key" ON "billing_campaigns"("code");
CREATE INDEX "billing_campaigns_status_period_start_period_end_idx" ON "billing_campaigns"("status", "period_start", "period_end");
CREATE INDEX "billing_campaigns_city_zone_status_idx" ON "billing_campaigns"("city", "zone", "status");
CREATE INDEX "billing_campaigns_tariff_plan_id_idx" ON "billing_campaigns"("tariff_plan_id");
CREATE INDEX "billing_campaigns_created_by_id_idx" ON "billing_campaigns"("created_by_id");
CREATE INDEX "billing_campaigns_deleted_at_idx" ON "billing_campaigns"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");
CREATE INDEX "invoices_campaign_id_status_idx" ON "invoices"("campaign_id", "status");
CREATE INDEX "invoices_customer_id_status_period_start_idx" ON "invoices"("customer_id", "status", "period_start");
CREATE INDEX "invoices_meter_id_period_start_period_end_idx" ON "invoices"("meter_id", "period_start", "period_end");
CREATE INDEX "invoices_tariff_plan_id_idx" ON "invoices"("tariff_plan_id");
CREATE INDEX "invoices_source_reading_id_idx" ON "invoices"("source_reading_id");
CREATE INDEX "invoices_from_reading_id_idx" ON "invoices"("from_reading_id");
CREATE INDEX "invoices_to_reading_id_idx" ON "invoices"("to_reading_id");
CREATE INDEX "invoices_deleted_at_idx" ON "invoices"("deleted_at");
CREATE UNIQUE INDEX "invoices_campaign_id_meter_id_key" ON "invoices"("campaign_id", "meter_id");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_type_idx" ON "invoice_lines"("invoice_id", "type");
CREATE INDEX "invoice_lines_deleted_at_idx" ON "invoice_lines"("deleted_at");

-- CreateIndex
CREATE INDEX "invoice_events_invoice_id_type_created_at_idx" ON "invoice_events"("invoice_id", "type", "created_at");
CREATE INDEX "invoice_events_user_id_idx" ON "invoice_events"("user_id");
CREATE INDEX "invoice_events_deleted_at_idx" ON "invoice_events"("deleted_at");

-- CreateIndex
CREATE INDEX "payments_invoice_id_paid_at_idx" ON "payments"("invoice_id", "paid_at");
CREATE INDEX "payments_received_by_id_idx" ON "payments"("received_by_id");
CREATE INDEX "payments_deleted_at_idx" ON "payments"("deleted_at");

-- CreateIndex
CREATE INDEX "invoice_deliveries_invoice_id_channel_status_idx" ON "invoice_deliveries"("invoice_id", "channel", "status");
CREATE INDEX "invoice_deliveries_triggered_by_id_idx" ON "invoice_deliveries"("triggered_by_id");
CREATE INDEX "invoice_deliveries_deleted_at_idx" ON "invoice_deliveries"("deleted_at");

-- CreateIndex
CREATE INDEX "reading_reminder_logs_user_id_channel_created_at_idx" ON "reading_reminder_logs"("user_id", "channel", "created_at");
CREATE INDEX "reading_reminder_logs_reminder_window_key_channel_status_idx" ON "reading_reminder_logs"("reminder_window_key", "channel", "status");
CREATE INDEX "reading_reminder_logs_deleted_at_idx" ON "reading_reminder_logs"("deleted_at");

-- AddForeignKey
ALTER TABLE "tariff_tiers" ADD CONSTRAINT "tariff_tiers_tariff_plan_id_fkey" FOREIGN KEY ("tariff_plan_id") REFERENCES "tariff_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "billing_campaigns" ADD CONSTRAINT "billing_campaigns_tariff_plan_id_fkey" FOREIGN KEY ("tariff_plan_id") REFERENCES "tariff_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "billing_campaigns" ADD CONSTRAINT "billing_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "billing_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tariff_plan_id_fkey" FOREIGN KEY ("tariff_plan_id") REFERENCES "tariff_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "meters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_source_reading_id_fkey" FOREIGN KEY ("source_reading_id") REFERENCES "readings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_from_reading_id_fkey" FOREIGN KEY ("from_reading_id") REFERENCES "readings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_to_reading_id_fkey" FOREIGN KEY ("to_reading_id") REFERENCES "readings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_canceled_by_id_fkey" FOREIGN KEY ("canceled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_events" ADD CONSTRAINT "invoice_events_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_events" ADD CONSTRAINT "invoice_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoice_deliveries" ADD CONSTRAINT "invoice_deliveries_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_deliveries" ADD CONSTRAINT "invoice_deliveries_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reading_reminder_logs" ADD CONSTRAINT "reading_reminder_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
