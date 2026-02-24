import { NextResponse } from "next/server";
import { getCurrentMobileClient } from "@/lib/auth/mobileSession";
import { resubmitClientReading } from "@/lib/mobile/readings";

export async function POST(
  request: Request,
  context: { params: Promise<{ readingId: string }> }
) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { readingId } = await context.params;
  if (!readingId) {
    return NextResponse.json({ error: "reading_id_required" }, { status: 400 });
  }

  try {
    const payload = await request.json();
    const result = await resubmitClientReading(auth.user.id, readingId, payload);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
