"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN_PERMISSION_GROUPS, requireAdminPermissions } from "@/lib/auth/adminPermissions";
import { updateTask } from "@/lib/backoffice/tasks";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;
  return value;
}

export async function updateTaskAction(taskId: string, formData: FormData) {
  const staff = await requireAdminPermissions(
    `/admin/tasks/${taskId}/edit`,
    ADMIN_PERMISSION_GROUPS.tasksManage
  );

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

  const result = await updateTask({ id: staff.id, role: staff.role }, taskId, payload);
  if (result.status !== 200) {
    redirect(`/admin/tasks/${taskId}/edit?error=${result.body.error || "update_failed"}`);
  }

  revalidatePath("/admin/tasks");
  revalidatePath(`/admin/tasks/${taskId}`);
  redirect(`/admin/tasks/${taskId}?updated=1`);
}
