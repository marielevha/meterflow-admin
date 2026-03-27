"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN_PERMISSION_GROUPS, requireAdminPermissions } from "@/lib/auth/adminPermissions";
import { addTaskAttachment, addTaskComment, addTaskItem, updateTask, updateTaskItem } from "@/lib/backoffice/tasks";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function addTaskCommentAction(taskId: string, formData: FormData) {
  const staff = await requireAdminPermissions(
    `/admin/tasks/${taskId}`,
    ADMIN_PERMISSION_GROUPS.tasksComment
  );

  const result = await addTaskComment(
    { id: staff.id, role: staff.role },
    taskId,
    {
      comment: asString(formData.get("comment")),
      isInternal: asString(formData.get("isInternal")) === "1",
    },
  );

  if (result.status >= 400) {
    redirect(`/admin/tasks/${taskId}?error=${result.body.error || "comment_failed"}`);
  }

  revalidatePath(`/admin/tasks/${taskId}`);
  redirect(`/admin/tasks/${taskId}?commented=1`);
}

export async function addTaskAttachmentAction(taskId: string, formData: FormData) {
  const staff = await requireAdminPermissions(
    `/admin/tasks/${taskId}`,
    ADMIN_PERMISSION_GROUPS.tasksAttachmentManage
  );

  const result = await addTaskAttachment(
    { id: staff.id, role: staff.role },
    taskId,
    {
      fileUrl: asString(formData.get("fileUrl")),
      fileName: asString(formData.get("fileName")),
      mimeType: asString(formData.get("mimeType")),
      fileHash: asString(formData.get("fileHash")),
      fileSizeBytes: Number(asString(formData.get("fileSizeBytes")) || "0"),
    },
  );

  if (result.status >= 400) {
    redirect(`/admin/tasks/${taskId}?error=${result.body.error || "attachment_failed"}`);
  }

  revalidatePath(`/admin/tasks/${taskId}`);
  redirect(`/admin/tasks/${taskId}?attachment=1`);
}

export async function addTaskItemAction(taskId: string, formData: FormData) {
  const staff = await requireAdminPermissions(
    `/admin/tasks/${taskId}`,
    ADMIN_PERMISSION_GROUPS.tasksItemManage
  );

  const result = await addTaskItem(
    { id: staff.id, role: staff.role },
    taskId,
    {
      title: asString(formData.get("title")),
      details: asString(formData.get("details")),
      sortOrder: Number(asString(formData.get("sortOrder")) || "0"),
    },
  );

  if (result.status >= 400) {
    redirect(`/admin/tasks/${taskId}?error=${result.body.error || "task_item_failed"}`);
  }

  revalidatePath(`/admin/tasks/${taskId}`);
  redirect(`/admin/tasks/${taskId}?item=1`);
}

export async function toggleTaskItemStatusAction(taskId: string, itemId: string, nextStatus: string) {
  const staff = await requireAdminPermissions(
    `/admin/tasks/${taskId}`,
    ADMIN_PERMISSION_GROUPS.tasksItemManage
  );

  const result = await updateTaskItem(
    { id: staff.id, role: staff.role },
    taskId,
    itemId,
    { status: nextStatus as never },
  );

  if (result.status >= 400) {
    redirect(`/admin/tasks/${taskId}?error=${result.body.error || "task_item_update_failed"}`);
  }

  revalidatePath(`/admin/tasks/${taskId}`);
  redirect(`/admin/tasks/${taskId}?item_updated=1`);
}

export async function quickUpdateTaskStatusAction(taskId: string, status: string) {
  const staff = await requireAdminPermissions(
    `/admin/tasks/${taskId}`,
    ADMIN_PERMISSION_GROUPS.tasksUpdate
  );

  const result = await updateTask(
    { id: staff.id, role: staff.role },
    taskId,
    { status: status as never },
  );

  if (result.status >= 400) {
    redirect(`/admin/tasks/${taskId}?error=${result.body.error || "status_update_failed"}`);
  }

  revalidatePath(`/admin/tasks/${taskId}`);
  revalidatePath("/admin/tasks");
  redirect(`/admin/tasks/${taskId}?status_updated=1`);
}
