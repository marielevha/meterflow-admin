import { NextResponse } from "next/server";
import { getCurrentMobileClient } from "@/lib/auth/mobileSession";
import { linkClientMeter } from "@/lib/mobile/meters";

export async function POST(request: Request) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const payload = await request.json();
    const result = await linkClientMeter(auth.user.id, payload);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}

