import { NextResponse } from "next/server";
import { getCurrentMobileClient } from "@/lib/auth/mobileSession";
import { getClientReadingDetail } from "@/lib/mobile/readings";

export async function GET(
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

  const result = await getClientReadingDetail(auth.user.id, readingId);
  return NextResponse.json(result.body, { status: result.status });
}
