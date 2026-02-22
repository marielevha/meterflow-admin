import { NextResponse } from "next/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { getReadingEvents } from "@/lib/backoffice/audit";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentStaffUser(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "reading_id_required" }, { status: 400 });
  }

  const result = await getReadingEvents(id);
  return NextResponse.json(result.body, { status: result.status });
}
