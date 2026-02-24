import { NextResponse } from "next/server";
import { getCurrentMobileClient } from "@/lib/auth/mobileSession";
import { createClientReading, listClientReadings } from "@/lib/mobile/readings";

export async function POST(request: Request) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const payload = await request.json();
    const result = await createClientReading(auth.user.id, payload);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;

  const result = await listClientReadings(auth.user.id, { status, dateFrom, dateTo });
  return NextResponse.json(result.body, { status: result.status });
}
