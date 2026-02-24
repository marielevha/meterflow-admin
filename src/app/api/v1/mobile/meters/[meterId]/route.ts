import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMobileClient } from "@/lib/auth/mobileSession";

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
      customerId: auth.user.id,
      deletedAt: null,
    },
    select: {
      id: true,
      serialNumber: true,
      meterReference: true,
      type: true,
      status: true,
      city: true,
      zone: true,
      addressLine1: true,
      addressLine2: true,
      latitude: true,
      longitude: true,
      installedAt: true,
      lastInspectionAt: true,
      createdAt: true,
      updatedAt: true,
      assignedAgent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          phone: true,
        },
      },
      states: {
        where: { deletedAt: null },
        orderBy: { effectiveAt: "desc" },
        take: 1,
        select: {
          id: true,
          effectiveAt: true,
          previousPrimary: true,
          previousSecondary: true,
          currentPrimary: true,
          currentSecondary: true,
        },
      },
    },
  });

  if (!meter) {
    return NextResponse.json({ error: "meter_not_found" }, { status: 404 });
  }

  return NextResponse.json({ meter }, { status: 200 });
}
