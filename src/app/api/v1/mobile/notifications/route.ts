import { NextResponse } from "next/server";

import { getCurrentMobileClient } from "@/lib/auth/mobileSession";
import {
  listClientNotifications,
  markClientNotificationsRead,
} from "@/lib/mobile/notifications";
import { withRouteInstrumentation } from "@/lib/observability/routeInstrumentation";

async function getNotifications(request: Request) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const url = new URL(request.url);
  const limitRaw = url.searchParams.get("limit");
  const cursorRaw = url.searchParams.get("cursor");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  const result = await listClientNotifications(auth.user.id, {
    limit: Number.isFinite(limit) ? limit : undefined,
    cursor: cursorRaw && cursorRaw.trim().length > 0 ? cursorRaw : undefined,
  });
  return NextResponse.json(result.body, { status: result.status });
}

async function patchNotifications(request: Request) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const payload = (await request.json().catch(() => ({}))) as {
      notificationIds?: unknown;
    };

    const notificationIds = Array.isArray(payload.notificationIds)
      ? payload.notificationIds.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0
        )
      : undefined;

    const result = await markClientNotificationsRead(auth.user.id, notificationIds);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}

export const GET = withRouteInstrumentation(
  "api.v1.mobile.notifications",
  getNotifications
);

export const PATCH = withRouteInstrumentation(
  "api.v1.mobile.notifications.patch",
  patchNotifications
);
