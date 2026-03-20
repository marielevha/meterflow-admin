import { NextResponse } from "next/server";

import { getCurrentMobileClient } from "@/lib/auth/mobileSession";
import { unregisterMobilePushDevice } from "@/lib/mobile/pushDevices";
import { withRouteInstrumentation } from "@/lib/observability/routeInstrumentation";

async function postUnregisterPushDevice(request: Request) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const payload = await request.json();
    const result = await unregisterMobilePushDevice(auth.user.id, payload);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}

export const POST = withRouteInstrumentation(
  "api.v1.mobile.push.unregister",
  postUnregisterPushDevice
);
