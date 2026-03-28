import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMobileClient } from "@/lib/auth/mobileSession";
import { activeAssignmentFilter } from "@/lib/meters/assignments";

export async function GET(
  request: Request,
  context: { params: Promise<{ meterId: string }> }
) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { meterId } = await context.params;
  if (!meterId) {
    return NextResponse.json({ error: "meter_id_required" }, { status: 400 });
  }

  const meter = await prisma.meter.findFirst({
    where: {
      id: meterId,
      ...activeAssignmentFilter(auth.user.id),
      deletedAt: null,
    },
    select: {
      id: true,
      serialNumber: true,
      meterReference: true,
      type: true,
      status: true,
    },
  });

  if (!meter) {
    return NextResponse.json({ error: "meter_not_found" }, { status: 404 });
  }

  const states = await prisma.meterState.findMany({
    where: {
      meterId: meter.id,
      deletedAt: null,
    },
    orderBy: { effectiveAt: "desc" },
    select: {
      id: true,
      meterId: true,
      sourceReadingId: true,
      previousPrimary: true,
      previousSecondary: true,
      currentPrimary: true,
      currentSecondary: true,
      effectiveAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ meter, states }, { status: 200 });
}
