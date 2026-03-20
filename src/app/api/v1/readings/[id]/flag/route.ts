import { NextResponse } from "next/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { flagReading } from "@/lib/backoffice/readings";
import { withRouteInstrumentation } from "@/lib/observability/routeInstrumentation";

async function postFlagReading(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentStaffUser(request, { anyOfPermissions: ["reading:flag"] });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "reading_id_required" }, { status: 400 });
  }

  try {
    const payload = await request.json();
    const result = await flagReading({ id: auth.user.id, role: auth.user.role }, id, payload);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}

export const POST = withRouteInstrumentation("api.v1.readings.flag", postFlagReading);
