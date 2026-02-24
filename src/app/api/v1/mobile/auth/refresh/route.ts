import { NextResponse } from "next/server";
import { refreshSession } from "@/lib/auth/refresh";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await refreshSession({
      refreshToken: typeof payload?.refreshToken === "string" ? payload.refreshToken : "",
      platform: "mobile",
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
