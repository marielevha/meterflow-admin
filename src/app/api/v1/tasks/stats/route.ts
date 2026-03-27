import { NextResponse } from "next/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { getTasksStats } from "@/lib/backoffice/tasks";

export async function GET(request: Request) {
  const auth = await getCurrentStaffUser(request, { anyOfPermissions: ["task:view"] });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const result = await getTasksStats({ id: auth.user.id, role: auth.user.role });
  return NextResponse.json(result.body, { status: result.status });
}
