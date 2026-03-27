import { NextResponse } from "next/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { buildUsersImportTemplateCsv } from "@/lib/backoffice/usersImport";

export async function GET(request: Request) {
  const auth = await getCurrentStaffUser(request, { anyOfPermissions: ["user:import"] });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const csv = buildUsersImportTemplateCsv();
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="users_import_template.csv"',
    },
  });
}
