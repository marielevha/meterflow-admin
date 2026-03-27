import { NextResponse } from "next/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { listPendingReadings } from "@/lib/backoffice/readings";
import { withRouteInstrumentation } from "@/lib/observability/routeInstrumentation";

async function getPendingReadings(request: Request) {
  const auth = await getCurrentStaffUser(request, { anyOfPermissions: ["reading:view"] });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const result = await listPendingReadings();
  return NextResponse.json(result.body, { status: result.status });
}

export const GET = withRouteInstrumentation("api.v1.readings.pending", getPendingReadings);
