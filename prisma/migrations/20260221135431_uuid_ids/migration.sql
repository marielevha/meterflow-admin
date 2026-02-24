/*
  Warnings:

  - The primary key for the `auth_sessions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `device_id` column on the `auth_sessions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `meter_states` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `source_reading_id` column on the `meter_states` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `meters` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `assigned_agent_id` column on the `meters` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `otp_codes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `user_id` column on the `otp_codes` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `permissions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `reading_events` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `user_id` column on the `reading_events` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `readings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `reviewed_by_id` column on the `readings` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `role_permissions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `roles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `task_attachments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `task_comments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `task_items` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `reading_id` column on the `task_items` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `meter_id` column on the `task_items` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `completed_by_id` column on the `task_items` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `tasks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `meter_id` column on the `tasks` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `reading_id` column on the `tasks` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `assigned_to_id` column on the `tasks` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `created_by_id` column on the `tasks` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `closed_by_id` column on the `tasks` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `user_role_assignments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `assigned_by_id` column on the `user_role_assignments` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `id` on the `auth_sessions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `auth_sessions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `meter_states` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `meter_id` on the `meter_states` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `meters` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `customer_id` on the `meters` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `otp_codes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `permissions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `reading_events` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `reading_id` on the `reading_events` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `readings` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `meter_id` on the `readings` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `submitted_by_id` on the `readings` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `role_permissions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `role_id` on the `role_permissions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `permission_id` on the `role_permissions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `roles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `task_attachments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `task_id` on the `task_attachments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `uploaded_by_id` on the `task_attachments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `task_comments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `task_id` on the `task_comments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `task_comments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `task_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `task_id` on the `task_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `tasks` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `user_role_assignments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `user_role_assignments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `role_id` on the `user_role_assignments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "auth_sessions" DROP CONSTRAINT "auth_sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "meter_states" DROP CONSTRAINT "meter_states_meter_id_fkey";

-- DropForeignKey
ALTER TABLE "meter_states" DROP CONSTRAINT "meter_states_source_reading_id_fkey";

-- DropForeignKey
ALTER TABLE "meters" DROP CONSTRAINT "meters_assigned_agent_id_fkey";

-- DropForeignKey
ALTER TABLE "meters" DROP CONSTRAINT "meters_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "otp_codes" DROP CONSTRAINT "otp_codes_user_id_fkey";

-- DropForeignKey
ALTER TABLE "reading_events" DROP CONSTRAINT "reading_events_reading_id_fkey";

-- DropForeignKey
ALTER TABLE "reading_events" DROP CONSTRAINT "reading_events_user_id_fkey";

-- DropForeignKey
ALTER TABLE "readings" DROP CONSTRAINT "readings_meter_id_fkey";

-- DropForeignKey
ALTER TABLE "readings" DROP CONSTRAINT "readings_reviewed_by_id_fkey";

-- DropForeignKey
ALTER TABLE "readings" DROP CONSTRAINT "readings_submitted_by_id_fkey";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_role_id_fkey";

-- DropForeignKey
ALTER TABLE "task_attachments" DROP CONSTRAINT "task_attachments_task_id_fkey";

-- DropForeignKey
ALTER TABLE "task_attachments" DROP CONSTRAINT "task_attachments_uploaded_by_id_fkey";

-- DropForeignKey
ALTER TABLE "task_comments" DROP CONSTRAINT "task_comments_task_id_fkey";

-- DropForeignKey
ALTER TABLE "task_comments" DROP CONSTRAINT "task_comments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "task_items" DROP CONSTRAINT "task_items_completed_by_id_fkey";

-- DropForeignKey
ALTER TABLE "task_items" DROP CONSTRAINT "task_items_meter_id_fkey";

-- DropForeignKey
ALTER TABLE "task_items" DROP CONSTRAINT "task_items_reading_id_fkey";

-- DropForeignKey
ALTER TABLE "task_items" DROP CONSTRAINT "task_items_task_id_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_assigned_to_id_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_closed_by_id_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_meter_id_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_reading_id_fkey";

-- DropForeignKey
ALTER TABLE "user_role_assignments" DROP CONSTRAINT "user_role_assignments_assigned_by_id_fkey";

-- DropForeignKey
ALTER TABLE "user_role_assignments" DROP CONSTRAINT "user_role_assignments_role_id_fkey";

-- DropForeignKey
ALTER TABLE "user_role_assignments" DROP CONSTRAINT "user_role_assignments_user_id_fkey";

-- AlterTable
ALTER TABLE "auth_sessions" DROP CONSTRAINT "auth_sessions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "device_id",
ADD COLUMN     "device_id" UUID,
ADD CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "meter_states" DROP CONSTRAINT "meter_states_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "meter_id",
ADD COLUMN     "meter_id" UUID NOT NULL,
DROP COLUMN "source_reading_id",
ADD COLUMN     "source_reading_id" UUID,
ADD CONSTRAINT "meter_states_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "meters" DROP CONSTRAINT "meters_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "customer_id",
ADD COLUMN     "customer_id" UUID NOT NULL,
DROP COLUMN "assigned_agent_id",
ADD COLUMN     "assigned_agent_id" UUID,
ADD CONSTRAINT "meters_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "otp_codes" DROP CONSTRAINT "otp_codes_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID,
ADD CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "permissions" DROP CONSTRAINT "permissions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "reading_events" DROP CONSTRAINT "reading_events_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "reading_id",
ADD COLUMN     "reading_id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID,
ADD CONSTRAINT "reading_events_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "readings" DROP CONSTRAINT "readings_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "meter_id",
ADD COLUMN     "meter_id" UUID NOT NULL,
DROP COLUMN "submitted_by_id",
ADD COLUMN     "submitted_by_id" UUID NOT NULL,
DROP COLUMN "reviewed_by_id",
ADD COLUMN     "reviewed_by_id" UUID,
ADD CONSTRAINT "readings_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "role_id",
ADD COLUMN     "role_id" UUID NOT NULL,
DROP COLUMN "permission_id",
ADD COLUMN     "permission_id" UUID NOT NULL,
ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "roles" DROP CONSTRAINT "roles_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "task_attachments" DROP CONSTRAINT "task_attachments_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "task_id",
ADD COLUMN     "task_id" UUID NOT NULL,
DROP COLUMN "uploaded_by_id",
ADD COLUMN     "uploaded_by_id" UUID NOT NULL,
ADD CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "task_comments" DROP CONSTRAINT "task_comments_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "task_id",
ADD COLUMN     "task_id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "task_items" DROP CONSTRAINT "task_items_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "task_id",
ADD COLUMN     "task_id" UUID NOT NULL,
DROP COLUMN "reading_id",
ADD COLUMN     "reading_id" UUID,
DROP COLUMN "meter_id",
ADD COLUMN     "meter_id" UUID,
DROP COLUMN "completed_by_id",
ADD COLUMN     "completed_by_id" UUID,
ADD CONSTRAINT "task_items_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "meter_id",
ADD COLUMN     "meter_id" UUID,
DROP COLUMN "reading_id",
ADD COLUMN     "reading_id" UUID,
DROP COLUMN "assigned_to_id",
ADD COLUMN     "assigned_to_id" UUID,
DROP COLUMN "created_by_id",
ADD COLUMN     "created_by_id" UUID,
DROP COLUMN "closed_by_id",
ADD COLUMN     "closed_by_id" UUID,
ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_role_assignments" DROP CONSTRAINT "user_role_assignments_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "role_id",
ADD COLUMN     "role_id" UUID NOT NULL,
DROP COLUMN "assigned_by_id",
ADD COLUMN     "assigned_by_id" UUID,
ADD CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_expires_at_idx" ON "auth_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "meter_states_meter_id_effective_at_idx" ON "meter_states"("meter_id", "effective_at");

-- CreateIndex
CREATE INDEX "meter_states_source_reading_id_idx" ON "meter_states"("source_reading_id");

-- CreateIndex
CREATE INDEX "meters_customer_id_idx" ON "meters"("customer_id");

-- CreateIndex
CREATE INDEX "meters_assigned_agent_id_idx" ON "meters"("assigned_agent_id");

-- CreateIndex
CREATE INDEX "otp_codes_user_id_idx" ON "otp_codes"("user_id");

-- CreateIndex
CREATE INDEX "reading_events_reading_id_type_created_at_idx" ON "reading_events"("reading_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "reading_events_user_id_idx" ON "reading_events"("user_id");

-- CreateIndex
CREATE INDEX "readings_meter_id_status_reading_at_idx" ON "readings"("meter_id", "status", "reading_at");

-- CreateIndex
CREATE INDEX "readings_submitted_by_id_status_idx" ON "readings"("submitted_by_id", "status");

-- CreateIndex
CREATE INDEX "readings_reviewed_by_id_idx" ON "readings"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "task_attachments_task_id_created_at_idx" ON "task_attachments"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "task_attachments_uploaded_by_id_idx" ON "task_attachments"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "task_comments_task_id_created_at_idx" ON "task_comments"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "task_comments_user_id_idx" ON "task_comments"("user_id");

-- CreateIndex
CREATE INDEX "task_items_task_id_sort_order_idx" ON "task_items"("task_id", "sort_order");

-- CreateIndex
CREATE INDEX "tasks_assigned_to_id_idx" ON "tasks"("assigned_to_id");

-- CreateIndex
CREATE INDEX "tasks_meter_id_reading_id_idx" ON "tasks"("meter_id", "reading_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_user_id_idx" ON "user_role_assignments"("user_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_role_id_idx" ON "user_role_assignments"("role_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_assigned_by_id_idx" ON "user_role_assignments"("assigned_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_assignments_user_id_role_id_key" ON "user_role_assignments"("user_id", "role_id");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
