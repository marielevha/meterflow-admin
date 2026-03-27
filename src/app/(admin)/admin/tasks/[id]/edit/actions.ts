"use server";

import { TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ADMIN_PERMISSION_GROUPS,
  hasAnyPermissionCode,
  requireAdminPermissions,
} from "@/lib/auth/adminPermissions";
import { getCurrentStaffPermissionCodes } from "@/lib/auth/staffServerSession";
import { updateTask } from "@/lib/backoffice/tasks";
import { prisma } from "@/lib/prisma";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;
  return value;
}

function normalizeComparableDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 16) : "";
}

export async function updateTaskAction(taskId: string, formData: FormData) {
  const staff = await requireAdminPermissions(`/admin/tasks/${taskId}/edit`, [
    ...ADMIN_PERMISSION_GROUPS.tasksUpdate,
    ...ADMIN_PERMISSION_GROUPS.tasksAssign,
  ]);
  const permissionCodes = await getCurrentStaffPermissionCodes(staff.id);
  const canUpdateTasks = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.tasksUpdate);
  const canAssignTasks = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.tasksAssign);

  const existingTask = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      status: true,
      priority: true,
      assignedToId: true,
      dueAt: true,
    },
  });

  if (!existingTask) {
    redirect(`/admin/tasks?error=task_not_found`);
  }

  const payload = {
    title: asOptionalString(formData.get("title")),
    description: asOptionalString(formData.get("description")),
    type: asOptionalString(formData.get("type")),
    status: asOptionalString(formData.get("status")),
    priority: asOptionalString(formData.get("priority")),
    assignedToId: asOptionalString(formData.get("assignedToId")),
    dueAt: asOptionalString(formData.get("dueAt")),
  };

  if (asString(formData.get("clearAssignee")) === "1") {
    payload.assignedToId = "";
  }

  if (asString(formData.get("clearDueAt")) === "1") {
    payload.dueAt = "";
  }

  const assignmentChanged =
    (payload.assignedToId ?? "") !== (existingTask.assignedToId ?? "");
  const metadataChanged =
    (payload.title ?? "") !== existingTask.title ||
    (payload.description ?? "") !== (existingTask.description ?? "") ||
    (payload.type ?? "") !== (existingTask.type as TaskType) ||
    (payload.status ?? "") !== (existingTask.status as TaskStatus) ||
    (payload.priority ?? "") !== (existingTask.priority as TaskPriority) ||
    (payload.dueAt ?? "") !== normalizeComparableDate(existingTask.dueAt);

  if (assignmentChanged && !canAssignTasks) {
    redirect(`/admin/tasks/${taskId}/edit?error=missing_permission`);
  }

  if (metadataChanged && !canUpdateTasks) {
    redirect(`/admin/tasks/${taskId}/edit?error=missing_permission`);
  }

  const result = await updateTask({ id: staff.id, role: staff.role }, taskId, payload);
  if (result.status !== 200) {
    redirect(`/admin/tasks/${taskId}/edit?error=${result.body.error || "update_failed"}`);
  }

  revalidatePath("/admin/tasks");
  revalidatePath(`/admin/tasks/${taskId}`);
  redirect(`/admin/tasks/${taskId}?updated=1`);
}
