import { NextResponse } from "next/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { previewMetersImportFromCsv } from "@/lib/backoffice/metersImport";

export async function POST(request: Request) {
  const auth = await getCurrentStaffUser(request, {
    anyOfPermissions: ["meter:import"],
    requireExplicitPermissions: true,
  });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file_required" }, { status: 400 });
    }

    const content = await file.text();
    const result = await previewMetersImportFromCsv(content);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, missingHeaders: result.missingHeaders },
        { status: result.status }
      );
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
