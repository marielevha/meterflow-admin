import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { getAppSettings, saveAppSettings } from "@/lib/settings/serverSettings";

export async function GET(request: Request) {
  const auth = await getCurrentStaffUser(request, { anyOfPermissions: ["dashboard:view"] });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const settings = await getAppSettings();
  return NextResponse.json({ settings }, { status: 200 });
}

export async function PATCH(request: Request) {
  const auth = await getCurrentStaffUser(request, { anyOfPermissions: ["user:manage"] });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  if (auth.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "admin_only_endpoint" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const settings = await saveAppSettings(payload);
    return NextResponse.json({ settings, message: "settings_updated" }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
