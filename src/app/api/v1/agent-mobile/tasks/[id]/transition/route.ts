import { NextResponse } from "next/server";

import { quickTransitionAgentMobileTask } from "@/lib/agentMobile/tasks";
import { getCurrentAgentMobileUser } from "@/lib/auth/agentMobileSession";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentAgentMobileUser(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        status?: unknown;
        comment?: unknown;
      }
    | null;

  if (!payload || typeof payload.status !== "string") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const comment =
    typeof payload.comment === "string" ? payload.comment : undefined;
  const { id } = await context.params;
  const result = await quickTransitionAgentMobileTask(
    { id: auth.user.id, role: auth.user.role },
    id,
    payload.status,
    comment
  );

  return NextResponse.json(result.body, { status: result.status });
}
