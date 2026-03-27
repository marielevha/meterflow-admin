import { NextResponse } from "next/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { runReadingChecks } from "@/lib/backoffice/audit";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentStaffUser(request, {
    anyOfPermissions: ["reading-event:view", "audit:view"],
  });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "reading_id_required" }, { status: 400 });
  }

  const result = await runReadingChecks({ id: auth.user.id, role: auth.user.role }, id);
  return NextResponse.json(result.body, { status: result.status });
}
