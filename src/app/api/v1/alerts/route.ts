import { NextResponse } from "next/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { listAlerts } from "@/lib/backoffice/audit";

export async function GET(request: Request) {
  const auth = await getCurrentStaffUser(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const result = await listAlerts({ from, to });
  return NextResponse.json(result.body, { status: result.status });
}
