import { NextResponse } from "next/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { buildMetersImportDemoCsv } from "@/lib/backoffice/metersImport";

export async function GET(request: Request) {
  const auth = await getCurrentStaffUser(request, {
    anyOfPermissions: ["meter:import"],
    requireExplicitPermissions: true,
  });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const result = await buildMetersImportDemoCsv();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return new NextResponse(result.data, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="meters_import_demo.csv"',
    },
  });
}
