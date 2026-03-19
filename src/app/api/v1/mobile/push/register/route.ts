import { NextResponse } from "next/server";

import { getCurrentMobileClient } from "@/lib/auth/mobileSession";
import { registerMobilePushDevice } from "@/lib/mobile/pushDevices";
import { logWarn } from "@/lib/observability/logger";
import { withRouteInstrumentation } from "@/lib/observability/routeInstrumentation";

async function postRegisterPushDevice(request: Request) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const payload = await request.json();
    const result = await registerMobilePushDevice(auth.user.id, payload);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logWarn({
      event: "mobile_push_register_failed",
      actorId: auth.user.id,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}

export const POST = withRouteInstrumentation(
  "api.v1.mobile.push.register",
  postRegisterPushDevice
);
