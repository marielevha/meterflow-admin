-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'AGENT', 'SUPERVISOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MeterType" AS ENUM ('SINGLE_INDEX', 'DUAL_INDEX');

-- CreateEnum
CREATE TYPE "MeterStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'REPLACED');

-- CreateEnum
CREATE TYPE "ReadingSource" AS ENUM ('CLIENT', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ReadingStatus" AS ENUM ('DRAFT', 'PENDING', 'FLAGGED', 'REJECTED', 'VALIDATED', 'RESUBMISSION_REQUESTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReadingEventType" AS ENUM ('CREATED', 'SUBMITTED', 'VALIDATED', 'FLAGGED', 'REJECTED', 'RESUBMITTED', 'TASK_CREATED', 'TASK_UPDATED', 'OCR_PROCESSED', 'ANOMALY_DETECTED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('FIELD_RECHECK', 'FRAUD_INVESTIGATION', 'METER_VERIFICATION', 'GENERAL');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TaskItemStatus" AS ENUM ('TODO', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'SIGNUP', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "OtpStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'CANCELED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "region" TEXT,
    "city" TEXT,
    "zone" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meters" (
    "id" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "meter_reference" TEXT,
    "customer_id" TEXT NOT NULL,
    "assigned_agent_id" TEXT,
    "type" "MeterType" NOT NULL DEFAULT 'SINGLE_INDEX',
    "status" "MeterStatus" NOT NULL DEFAULT 'ACTIVE',
    "address_line_1" TEXT,
    "address_line_2" TEXT,
    "city" TEXT,
    "zone" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "installed_at" TIMESTAMP(3),
    "last_inspection_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "meters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter_states" (
    "id" TEXT NOT NULL,
    "meter_id" TEXT NOT NULL,
    "source_reading_id" TEXT,
    "previous_primary" DECIMAL(14,3),
    "previous_secondary" DECIMAL(14,3),
    "current_primary" DECIMAL(14,3),
    "current_secondary" DECIMAL(14,3),
    "effective_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "meter_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readings" (
    "id" TEXT NOT NULL,
    "meter_id" TEXT NOT NULL,
    "submitted_by_id" TEXT NOT NULL,
    "reviewed_by_id" TEXT,
    "source" "ReadingSource" NOT NULL DEFAULT 'CLIENT',
    "status" "ReadingStatus" NOT NULL DEFAULT 'PENDING',
    "reading_at" TIMESTAMP(3) NOT NULL,
    "primary_index" DECIMAL(14,3) NOT NULL,
    "secondary_index" DECIMAL(14,3),
    "image_url" TEXT NOT NULL,
    "image_hash" TEXT,
    "image_mime_type" TEXT,
    "image_size_bytes" INTEGER,
    "gps_latitude" DECIMAL(10,7),
    "gps_longitude" DECIMAL(10,7),
    "gps_accuracy_meters" DECIMAL(10,2),
    "gps_distance_meters" DECIMAL(10,2),
    "idempotency_key" TEXT,
    "rejection_reason" TEXT,
    "flag_reason" TEXT,
    "confidence_score" DECIMAL(5,2),
    "anomaly_score" DECIMAL(6,3),
    "ocr_text" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_events" (
    "id" TEXT NOT NULL,
    "reading_id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" "ReadingEventType" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reading_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "meter_id" TEXT,
    "reading_id" TEXT,
    "assigned_to_id" TEXT,
    "created_by_id" TEXT,
    "closed_by_id" TEXT,
    "type" "TaskType" NOT NULL DEFAULT 'GENERAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_items" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "reading_id" TEXT,
    "meter_id" TEXT,
    "completed_by_id" TEXT,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "status" "TaskItemStatus" NOT NULL DEFAULT 'TODO',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "task_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_attachments" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_hash" TEXT,
    "file_size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "phone" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "status" "OtpStatus" NOT NULL DEFAULT 'PENDING',
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_family" TEXT,
    "refresh_token_hash" TEXT NOT NULL,
    "access_token_jti" TEXT,
    "device_id" TEXT,
    "device_name" TEXT,
    "platform" TEXT,
    "app_version" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "meters_serial_number_key" ON "meters"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "meters_meter_reference_key" ON "meters"("meter_reference");

-- CreateIndex
CREATE INDEX "meters_customer_id_idx" ON "meters"("customer_id");

-- CreateIndex
CREATE INDEX "meters_assigned_agent_id_idx" ON "meters"("assigned_agent_id");

-- CreateIndex
CREATE INDEX "meters_status_city_zone_idx" ON "meters"("status", "city", "zone");

-- CreateIndex
CREATE INDEX "meters_deleted_at_idx" ON "meters"("deleted_at");

-- CreateIndex
CREATE INDEX "meter_states_meter_id_effective_at_idx" ON "meter_states"("meter_id", "effective_at");

-- CreateIndex
CREATE INDEX "meter_states_source_reading_id_idx" ON "meter_states"("source_reading_id");

-- CreateIndex
CREATE INDEX "meter_states_deleted_at_idx" ON "meter_states"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "readings_idempotency_key_key" ON "readings"("idempotency_key");

-- CreateIndex
CREATE INDEX "readings_meter_id_status_reading_at_idx" ON "readings"("meter_id", "status", "reading_at");

-- CreateIndex
CREATE INDEX "readings_submitted_by_id_status_idx" ON "readings"("submitted_by_id", "status");

-- CreateIndex
CREATE INDEX "readings_reviewed_by_id_idx" ON "readings"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "readings_deleted_at_idx" ON "readings"("deleted_at");

-- CreateIndex
CREATE INDEX "reading_events_reading_id_type_created_at_idx" ON "reading_events"("reading_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "reading_events_user_id_idx" ON "reading_events"("user_id");

-- CreateIndex
CREATE INDEX "reading_events_deleted_at_idx" ON "reading_events"("deleted_at");

-- CreateIndex
CREATE INDEX "tasks_status_priority_due_at_idx" ON "tasks"("status", "priority", "due_at");

-- CreateIndex
CREATE INDEX "tasks_assigned_to_id_idx" ON "tasks"("assigned_to_id");

-- CreateIndex
CREATE INDEX "tasks_meter_id_reading_id_idx" ON "tasks"("meter_id", "reading_id");

-- CreateIndex
CREATE INDEX "tasks_deleted_at_idx" ON "tasks"("deleted_at");

-- CreateIndex
CREATE INDEX "task_items_task_id_sort_order_idx" ON "task_items"("task_id", "sort_order");

-- CreateIndex
CREATE INDEX "task_items_status_completed_at_idx" ON "task_items"("status", "completed_at");

-- CreateIndex
CREATE INDEX "task_items_deleted_at_idx" ON "task_items"("deleted_at");

-- CreateIndex
CREATE INDEX "task_comments_task_id_created_at_idx" ON "task_comments"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "task_comments_user_id_idx" ON "task_comments"("user_id");

-- CreateIndex
CREATE INDEX "task_comments_deleted_at_idx" ON "task_comments"("deleted_at");

-- CreateIndex
CREATE INDEX "task_attachments_task_id_created_at_idx" ON "task_attachments"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "task_attachments_uploaded_by_id_idx" ON "task_attachments"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "task_attachments_deleted_at_idx" ON "task_attachments"("deleted_at");

-- CreateIndex
CREATE INDEX "otp_codes_phone_purpose_status_expires_at_idx" ON "otp_codes"("phone", "purpose", "status", "expires_at");

-- CreateIndex
CREATE INDEX "otp_codes_user_id_idx" ON "otp_codes"("user_id");

-- CreateIndex
CREATE INDEX "otp_codes_deleted_at_idx" ON "otp_codes"("deleted_at");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_expires_at_idx" ON "auth_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "auth_sessions_token_family_idx" ON "auth_sessions"("token_family");

-- CreateIndex
CREATE INDEX "auth_sessions_deleted_at_idx" ON "auth_sessions"("deleted_at");

-- AddForeignKey
ALTER TABLE "meters" ADD CONSTRAINT "meters_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meters" ADD CONSTRAINT "meters_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_states" ADD CONSTRAINT "meter_states_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "meters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_states" ADD CONSTRAINT "meter_states_source_reading_id_fkey" FOREIGN KEY ("source_reading_id") REFERENCES "readings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "readings" ADD CONSTRAINT "readings_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "meters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "readings" ADD CONSTRAINT "readings_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "readings" ADD CONSTRAINT "readings_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_events" ADD CONSTRAINT "reading_events_reading_id_fkey" FOREIGN KEY ("reading_id") REFERENCES "readings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_events" ADD CONSTRAINT "reading_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "meters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reading_id_fkey" FOREIGN KEY ("reading_id") REFERENCES "readings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_items" ADD CONSTRAINT "task_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_items" ADD CONSTRAINT "task_items_reading_id_fkey" FOREIGN KEY ("reading_id") REFERENCES "readings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_items" ADD CONSTRAINT "task_items_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "meters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_items" ADD CONSTRAINT "task_items_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
