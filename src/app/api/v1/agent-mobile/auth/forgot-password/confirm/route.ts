import { NextResponse } from "next/server";
import { confirmAgentPasswordReset } from "@/lib/auth/agentMobile";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await confirmAgentPasswordReset(payload);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
