import { NextResponse } from "next/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { getDashboardGpsSuspicions } from "@/lib/backoffice/dashboard";

export async function GET(request: Request) {
  const auth = await getCurrentStaffUser(request, { anyOfPermissions: ["dashboard:view", "audit:view"] });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const result = await getDashboardGpsSuspicions({ from, to });
  return NextResponse.json(result.body, { status: result.status });
}
