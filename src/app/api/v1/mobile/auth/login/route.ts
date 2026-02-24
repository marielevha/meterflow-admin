import { NextResponse } from "next/server";
import { loginUser } from "@/lib/auth/login";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await loginUser(
      { ...payload, platform: "mobile" },
      { allowedIdentifiers: ["phone", "username", "email"] }
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
