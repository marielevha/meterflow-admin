import { NextResponse } from "next/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { updateTaskItem } from "@/lib/backoffice/tasks";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  const auth = await getCurrentStaffUser(request, { anyOfPermissions: ["task:item:manage"] });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { id, itemId } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "task_id_required" }, { status: 400 });
  }
  if (!itemId) {
    return NextResponse.json({ error: "task_item_id_required" }, { status: 400 });
  }

  try {
    const payload = await request.json();
    const result = await updateTaskItem(
      { id: auth.user.id, role: auth.user.role },
      id,
      itemId,
      payload,
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
