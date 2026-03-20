import { NextResponse } from "next/server";

import { getCurrentMobileClient } from "@/lib/auth/mobileSession";
import { getClientConsumptionDetail } from "@/lib/mobile/consumption";

export async function GET(
  request: Request,
  context: { params: Promise<{ meterId: string }> }
) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { meterId } = await context.params;
  const { searchParams } = new URL(request.url);
  const periodKey = searchParams.get("periodKey");

  if (!meterId || !periodKey) {
    return NextResponse.json({ error: "meter_id_and_period_key_required" }, { status: 400 });
  }

  const result = await getClientConsumptionDetail(auth.user.id, meterId, periodKey);
  return NextResponse.json(result.body, { status: result.status });
}
