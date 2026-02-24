import { NextResponse } from "next/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { listPendingReadings } from "@/lib/backoffice/readings";

export async function GET(request: Request) {
  const auth = await getCurrentStaffUser(request, { anyOfPermissions: ["reading:view", "reading:review"] });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const result = await listPendingReadings();
  return NextResponse.json(result.body, { status: result.status });
}
