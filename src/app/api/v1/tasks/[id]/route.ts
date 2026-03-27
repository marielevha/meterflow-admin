import { NextResponse } from "next/server";
import { ADMIN_PERMISSION_GROUPS, hasAnyPermissionCode } from "@/lib/auth/adminPermissions";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { getCurrentStaffPermissionCodes } from "@/lib/auth/staffServerSession";
import { getTaskDetail, updateTask } from "@/lib/backoffice/tasks";
import { withRouteInstrumentation } from "@/lib/observability/routeInstrumentation";

async function getTask(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentStaffUser(request, { anyOfPermissions: ["task:view"] });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "task_id_required" }, { status: 400 });
  }

  const result = await getTaskDetail({ id: auth.user.id, role: auth.user.role }, id);
  return NextResponse.json(result.body, { status: result.status });
}

async function patchTask(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentStaffUser(request, { anyOfPermissions: ["task:update", "task:assign"] });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "task_id_required" }, { status: 400 });
  }

  try {
    const payload = await request.json();
    const permissionCodes = await getCurrentStaffPermissionCodes(auth.user.id);
    const canUpdateTasks = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.tasksUpdate);
    const canAssignTasks = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.tasksAssign);
    const changesTaskAssignment = payload?.assignedToId !== undefined;
    const changesTaskMetadata =
      payload?.status !== undefined ||
      payload?.priority !== undefined ||
      payload?.type !== undefined ||
      payload?.title !== undefined ||
      payload?.description !== undefined ||
      payload?.dueAt !== undefined;

    if (changesTaskAssignment && !canAssignTasks) {
      return NextResponse.json({ error: "missing_permission" }, { status: 403 });
    }

    if (changesTaskMetadata && !canUpdateTasks) {
      return NextResponse.json({ error: "missing_permission" }, { status: 403 });
    }

    const result = await updateTask({ id: auth.user.id, role: auth.user.role }, id, payload);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}

export const GET = withRouteInstrumentation("api.v1.tasks.detail", getTask);
export const PATCH = withRouteInstrumentation("api.v1.tasks.update", patchTask);
