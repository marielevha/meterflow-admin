import { prisma } from "@/lib/prisma";
import { activeAssignmentFilter } from "@/lib/meters/assignments";

function decimalToNumber(value: { toString(): string } | number | string | null) {
  if (value === null || value === undefined) return null;
  const num = Number(typeof value === "object" ? value.toString() : value);
  return Number.isFinite(num) ? num : null;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

type GroupedConsumption = {
  meterId: string;
  meterSerialNumber: string;
  meterType: string;
  periodKey: string;
  periodLabel: string;
  primaryConsumption: number;
  secondaryConsumption: number | null;
  totalConsumption: number;
  lastEffectiveAt: Date;
};

export async function listClientConsumption(
  userId: string,
  params: { meterId?: string; limit?: number } = {}
) {
  const meters = await prisma.meter.findMany({
    where: {
      ...activeAssignmentFilter(userId),
      deletedAt: null,
    },
    select: {
      id: true,
      serialNumber: true,
      type: true,
    },
    orderBy: { serialNumber: "asc" },
  });

  if (meters.length === 0) {
    return {
      status: 200,
      body: {
        meters: [],
        consumptions: [],
      },
    };
  }

  const selectedMeterIds =
    params.meterId && meters.some((meter) => meter.id === params.meterId)
      ? [params.meterId]
      : meters.map((meter) => meter.id);

  const states = await prisma.meterState.findMany({
    where: {
      meterId: { in: selectedMeterIds },
      deletedAt: null,
    },
    orderBy: [{ effectiveAt: "desc" }],
    select: {
      meterId: true,
      previousPrimary: true,
      currentPrimary: true,
      previousSecondary: true,
      currentSecondary: true,
      effectiveAt: true,
      meter: {
        select: {
          serialNumber: true,
          type: true,
        },
      },
    },
  });

  const grouped = new Map<string, GroupedConsumption>();

  for (const state of states) {
    const previousPrimary = decimalToNumber(state.previousPrimary);
    const currentPrimary = decimalToNumber(state.currentPrimary);
    const previousSecondary = decimalToNumber(state.previousSecondary);
    const currentSecondary = decimalToNumber(state.currentSecondary);

    const primaryConsumption =
      previousPrimary !== null && currentPrimary !== null
        ? Math.max(0, currentPrimary - previousPrimary)
        : null;

    const secondaryConsumption =
      previousSecondary !== null && currentSecondary !== null
        ? Math.max(0, currentSecondary - previousSecondary)
        : null;

    if (primaryConsumption === null && secondaryConsumption === null) {
      continue;
    }

    const key = `${state.meterId}:${monthKey(state.effectiveAt)}`;
    const existing = grouped.get(key);
    const nextSecondary = secondaryConsumption ?? 0;

    if (existing) {
      existing.primaryConsumption += primaryConsumption ?? 0;
      existing.secondaryConsumption =
        existing.secondaryConsumption === null && secondaryConsumption === null
          ? null
          : (existing.secondaryConsumption ?? 0) + nextSecondary;
      existing.totalConsumption += (primaryConsumption ?? 0) + nextSecondary;
      if (state.effectiveAt > existing.lastEffectiveAt) {
        existing.lastEffectiveAt = state.effectiveAt;
      }
      continue;
    }

    grouped.set(key, {
      meterId: state.meterId,
      meterSerialNumber: state.meter.serialNumber,
      meterType: state.meter.type,
      periodKey: monthKey(state.effectiveAt),
      periodLabel: monthLabel(state.effectiveAt),
      primaryConsumption: primaryConsumption ?? 0,
      secondaryConsumption: secondaryConsumption,
      totalConsumption: (primaryConsumption ?? 0) + nextSecondary,
      lastEffectiveAt: state.effectiveAt,
    });
  }

  const limit = params.limit && Number.isFinite(params.limit) ? Math.max(1, params.limit) : 12;

  const consumptions = [...grouped.values()]
    .sort((a, b) => b.lastEffectiveAt.getTime() - a.lastEffectiveAt.getTime())
    .slice(0, limit)
    .map((item) => ({
      meterId: item.meterId,
      meterSerialNumber: item.meterSerialNumber,
      meterType: item.meterType,
      periodKey: item.periodKey,
      periodLabel: item.periodLabel,
      primaryConsumption: item.primaryConsumption,
      secondaryConsumption: item.secondaryConsumption,
      totalConsumption: item.totalConsumption,
      effectiveAt: item.lastEffectiveAt,
    }));

  return {
    status: 200,
    body: {
      meters,
      consumptions,
    },
  };
}

export async function getClientConsumptionDetail(
  userId: string,
  meterId: string,
  periodKey: string
) {
  const meter = await prisma.meter.findFirst({
    where: {
      id: meterId,
      ...activeAssignmentFilter(userId),
      deletedAt: null,
    },
    select: {
      id: true,
      serialNumber: true,
      meterReference: true,
      type: true,
      city: true,
      zone: true,
    },
  });

  if (!meter) {
    return { status: 404, body: { error: "meter_not_found" } };
  }

  if (!/^\d{4}-\d{2}$/.test(periodKey)) {
    return { status: 400, body: { error: "invalid_period_key" } };
  }

  const [year, month] = periodKey.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const states = await prisma.meterState.findMany({
    where: {
      meterId,
      deletedAt: null,
      effectiveAt: {
        gte: start,
        lt: end,
      },
    },
    orderBy: [{ effectiveAt: "desc" }],
    select: {
      id: true,
      effectiveAt: true,
      previousPrimary: true,
      currentPrimary: true,
      previousSecondary: true,
      currentSecondary: true,
      sourceReadingId: true,
      createdAt: true,
    },
  });

  let primaryConsumption = 0;
  let secondaryConsumption = 0;

  const items = states.map((state) => {
    const previousPrimary = decimalToNumber(state.previousPrimary);
    const currentPrimary = decimalToNumber(state.currentPrimary);
    const previousSecondary = decimalToNumber(state.previousSecondary);
    const currentSecondary = decimalToNumber(state.currentSecondary);

    const deltaPrimary =
      previousPrimary !== null && currentPrimary !== null
        ? Math.max(0, currentPrimary - previousPrimary)
        : null;
    const deltaSecondary =
      previousSecondary !== null && currentSecondary !== null
        ? Math.max(0, currentSecondary - previousSecondary)
        : null;

    primaryConsumption += deltaPrimary ?? 0;
    secondaryConsumption += deltaSecondary ?? 0;

    return {
      id: state.id,
      effectiveAt: state.effectiveAt,
      sourceReadingId: state.sourceReadingId,
      previousPrimary,
      currentPrimary,
      previousSecondary,
      currentSecondary,
      deltaPrimary,
      deltaSecondary,
      createdAt: state.createdAt,
    };
  });

  return {
    status: 200,
    body: {
      consumption: {
        meter,
        periodKey,
        periodLabel: monthLabel(start),
        primaryConsumption,
        secondaryConsumption: meter.type === "DUAL_INDEX" ? secondaryConsumption : null,
        totalConsumption:
          primaryConsumption + (meter.type === "DUAL_INDEX" ? secondaryConsumption : 0),
        items,
      },
    },
  };
}
