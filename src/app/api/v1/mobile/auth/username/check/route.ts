import { NextResponse } from "next/server";

import { checkUsernameAvailability } from "@/lib/auth/username";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { username?: string };
    const result = await checkUsernameAvailability(payload.username);

    if (result.ok) {
      return NextResponse.json({
        username: result.normalized,
        available: true,
      });
    }

    const status = result.error === "username_already_exists" ? 409 : 400;
    return NextResponse.json(
      {
        error: result.error,
        username: result.normalized,
        available: false,
        suggestion: result.suggestion ?? null,
      },
      { status }
    );
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
