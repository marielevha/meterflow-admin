import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAgentMobileUser } from "@/lib/auth/agentMobileSession";

const agentProfileSelect = {
  id: true,
  phone: true,
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  region: true,
  city: true,
  zone: true,
  role: true,
  status: true,
  activatedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(request: Request) {
  const auth = await getCurrentAgentMobileUser(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const { passwordHash: _passwordHash, ...safeUser } = auth.user;
  const [meterCount, readingCount] = await Promise.all([
    prisma.meter.count({
      where: {
        assignedAgentId: auth.user.id,
        deletedAt: null,
      },
    }),
    prisma.reading.count({
      where: {
        reviewedById: auth.user.id,
        deletedAt: null,
      },
    }),
  ]);

  return NextResponse.json(
    {
      user: safeUser,
      summary: {
        meterCount,
        readingCount,
      },
    },
    { status: 200 }
  );
}

export async function PATCH(request: Request) {
  const auth = await getCurrentAgentMobileUser(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  try {
    const payload = await request.json();
    const firstName =
      typeof payload?.firstName === "string" ? payload.firstName.trim() || null : undefined;
    const lastName =
      typeof payload?.lastName === "string" ? payload.lastName.trim() || null : undefined;
    const region = typeof payload?.region === "string" ? payload.region.trim() || null : undefined;
    const city = typeof payload?.city === "string" ? payload.city.trim() || null : undefined;
    const zone = typeof payload?.zone === "string" ? payload.zone.trim() || null : undefined;

    if (
      firstName === undefined &&
      lastName === undefined &&
      region === undefined &&
      city === undefined &&
      zone === undefined
    ) {
      return NextResponse.json({ error: "no_updatable_fields" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(region !== undefined ? { region } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(zone !== undefined ? { zone } : {}),
      },
      select: agentProfileSelect,
    });

    return NextResponse.json({ message: "profile_updated", user: updated }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
