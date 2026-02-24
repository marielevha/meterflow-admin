import { NextResponse } from "next/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { createTask, listTasks } from "@/lib/backoffice/tasks";

export async function GET(request: Request) {
  const auth = await getCurrentStaffUser(request, { anyOfPermissions: ["task:update", "task:assign"] });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const filters = {
    q: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    assignedToId: searchParams.get("assignedToId") ?? undefined,
    meterId: searchParams.get("meterId") ?? undefined,
    readingId: searchParams.get("readingId") ?? undefined,
    page: Number(searchParams.get("page") ?? "1"),
    pageSize: Number(searchParams.get("pageSize") ?? "10"),
  };

  const result = await listTasks({ id: auth.user.id, role: auth.user.role }, filters);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  const auth = await getCurrentStaffUser(request, { anyOfPermissions: ["task:create"] });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const payload = await request.json();
    const result = await createTask({ id: auth.user.id, role: auth.user.role }, payload);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
