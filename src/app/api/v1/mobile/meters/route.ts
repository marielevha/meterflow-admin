import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMobileClient } from "@/lib/auth/mobileSession";
import {
  resolveClientReadingSubmissionWindows,
  serializeClientReadingSubmissionWindow,
} from "@/lib/mobile/readingSubmissionWindow";

export async function GET(request: Request) {
  const auth = await getCurrentMobileClient(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const meters = await prisma.meter.findMany({
    where: {
      customerId: auth.user.id,
      deletedAt: null,
    },
    select: {
      id: true,
      zoneId: true,
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
    orderBy: [{ createdAt: "desc" }],
  });

  const windows = await resolveClientReadingSubmissionWindows(meters.map((meter) => meter.zoneId));

  return NextResponse.json(
    {
      meters: meters.map(({ zoneId, ...meter }) => ({
        ...meter,
        readingSubmissionWindow: serializeClientReadingSubmissionWindow(
          zoneId ? windows.byZoneId.get(zoneId) ?? windows.defaultWindow : windows.defaultWindow
        ),
      })),
    },
    { status: 200 }
  );
}
