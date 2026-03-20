import { NextResponse } from "next/server";

import { getCurrentMobileClient } from "@/lib/auth/mobileSession";
import { listClientConsumption } from "@/lib/mobile/consumption";

export async function GET(request: Request) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const meterId = searchParams.get("meterId") ?? undefined;
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  const result = await listClientConsumption(auth.user.id, { meterId, limit });
  return NextResponse.json(result.body, { status: result.status });
}
