import { NextResponse } from "next/server";

import { getCurrentMobileClient } from "@/lib/auth/mobileSession";
import { listClientNotifications } from "@/lib/mobile/notifications";
import { withRouteInstrumentation } from "@/lib/observability/routeInstrumentation";

async function getNotifications(request: Request) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const result = await listClientNotifications(auth.user.id);
  return NextResponse.json(result.body, { status: result.status });
}

export const GET = withRouteInstrumentation(
  "api.v1.mobile.notifications",
  getNotifications
);
