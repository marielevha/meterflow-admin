import { NextResponse } from "next/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { validateReading } from "@/lib/backoffice/readings";
import { withRouteInstrumentation } from "@/lib/observability/routeInstrumentation";

async function postValidateReading(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentStaffUser(request, { anyOfPermissions: ["reading:review"] });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "reading_id_required" }, { status: 400 });
  }

  const result = await validateReading({ id: auth.user.id, role: auth.user.role }, id);
  return NextResponse.json(result.body, { status: result.status });
}

export const POST = withRouteInstrumentation("api.v1.readings.validate", postValidateReading);
