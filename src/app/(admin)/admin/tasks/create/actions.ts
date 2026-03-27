"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN_PERMISSION_GROUPS, requireAdminPermissions } from "@/lib/auth/adminPermissions";
import { createTask } from "@/lib/backoffice/tasks";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: string) {
  return value ? value : null;
}

export async function createTaskAction(formData: FormData) {
  const staff = await requireAdminPermissions("/admin/tasks/create", ADMIN_PERMISSION_GROUPS.tasksCreate);

  const payload = {
    title: asString(formData.get("title")),
    description: asString(formData.get("description")),
    type: asString(formData.get("type")),
    priority: asString(formData.get("priority")),
    status: asString(formData.get("status")),
    assignedToId: nullable(asString(formData.get("assignedToId"))),
    meterId: nullable(asString(formData.get("meterId"))),
    readingId: nullable(asString(formData.get("readingId"))),
    dueAt: nullable(asString(formData.get("dueAt"))),
  };

  const result = await createTask({ id: staff.id, role: staff.role }, payload);
  if (result.status !== 201 || !("task" in result.body) || !result.body.task) {
    redirect(`/admin/tasks/create?error=${result.body.error || "create_failed"}`);
  }

  revalidatePath("/admin/tasks");
  redirect(`/admin/tasks/${result.body.task.id}?created=1`);
}
