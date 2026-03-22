import { NextResponse } from "next/server";

import { generateAvailableUsernameFromNames } from "@/lib/auth/username";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { firstName?: string; lastName?: string };
    const result = await generateAvailableUsernameFromNames(payload.firstName, payload.lastName);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      username: result.username,
      base: result.base,
    });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
