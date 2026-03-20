import { NextResponse } from "next/server";

import { getCurrentAgentMobileUser } from "@/lib/auth/agentMobileSession";
import {
  listAgentNotifications,
  markAgentNotificationsRead,
} from "@/lib/agentMobile/notifications";

export async function GET(request: Request) {
  const auth = await getCurrentAgentMobileUser(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const url = new URL(request.url);
  const limitRaw = url.searchParams.get("limit");
  const cursorRaw = url.searchParams.get("cursor");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  const result = await listAgentNotifications(auth.user.id, {
    limit: Number.isFinite(limit) ? limit : undefined,
    cursor: cursorRaw && cursorRaw.trim().length > 0 ? cursorRaw : undefined,
  });

  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: Request) {
  const auth = await getCurrentAgentMobileUser(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const payload = (await request.json().catch(() => ({}))) as {
      notificationIds?: unknown;
    };

    const notificationIds = Array.isArray(payload.notificationIds)
      ? payload.notificationIds.filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0
        )
      : undefined;

    const result = await markAgentNotificationsRead(
      auth.user.id,
      notificationIds
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
