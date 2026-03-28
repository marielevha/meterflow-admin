import { NextResponse } from "next/server";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import { getCurrentStaffUser } from "@/lib/auth/staffSession";
import { getCurrentStaffPermissionCodes } from "@/lib/auth/staffServerSession";
import { searchAdminResources } from "@/lib/backoffice/globalSearch";
import { withRouteInstrumentation } from "@/lib/observability/routeInstrumentation";

async function getGlobalSearch(request: Request) {
  const auth = await getCurrentStaffUser(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const permissionCodes = await getCurrentStaffPermissionCodes(auth.user.id);
  const { t } = await getAdminTranslator();

  const result = await searchAdminResources({
    query,
    permissionCodes,
    t,
    limitPerGroup: 5,
  });

  return NextResponse.json(result, { status: 200 });
}

export const GET = withRouteInstrumentation("api.v1.search.global", getGlobalSearch);
