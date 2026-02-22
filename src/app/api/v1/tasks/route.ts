import { NextResponse } from "next/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { listTasks } from "@/lib/backoffice/tasks";

export async function GET(request: Request) {
  const auth = await getCurrentStaffUser(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const filters = {
    status: searchParams.get("status") ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    assignedToId: searchParams.get("assignedToId") ?? undefined,
    meterId: searchParams.get("meterId") ?? undefined,
    readingId: searchParams.get("readingId") ?? undefined,
  };

  const result = await listTasks(filters);
  return NextResponse.json(result.body, { status: result.status });
}
