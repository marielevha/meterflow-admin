import {
  MeterType,
  Prisma,
  ServicePhaseType,
  ServicePowerUnit,
  ServiceUsageCategory,
  TariffBillingMode,
  TaxApplicationScope,
  TaxRuleType,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type StaffUser = {
  id: string;
  role: UserRole;
};

export type CreateServiceContractInput = {
  meterId?: string | null;
  contractNumber?: string | null;
  policeNumber?: string | null;
  usageCategory?: ServiceUsageCategory | null;
  billingMode?: TariffBillingMode | null;
  subscribedPowerValue?: number | string | null;
  subscribedPowerUnit?: ServicePowerUnit | null;
  phaseType?: ServicePhaseType | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  notes?: string | null;
};

type BillingAssignmentRecord = {
  id: string;
  meterId: string;
  customerId: string;
  assignedAt: Date;
  endedAt: Date | null;
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    phone: string | null;
  };
};

export type BillingContractRecord = {
  id: string;
  meterId: string;
  customerId: string;
  contractNumber: string | null;
  policeNumber: string | null;
  usageCategory: ServiceUsageCategory;
  billingMode: TariffBillingMode;
  subscribedPowerValue: Prisma.Decimal;
  subscribedPowerUnit: ServicePowerUnit;
  phaseType: ServicePhaseType;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  notes: string | null;
};

type BillingTariffRecord = {
  id: string;
  code: string;
  name: string;
  zoneId: string | null;
  billingMode: TariffBillingMode;
  usageCategory: ServiceUsageCategory;
  subscribedPowerUnit: ServicePowerUnit;
  subscribedPowerMin: Prisma.Decimal | null;
  subscribedPowerMax: Prisma.Decimal | null;
  phaseType: ServicePhaseType | null;
  currency: string;
  singleUnitPrice: Prisma.Decimal | null;
  hpUnitPrice: Prisma.Decimal | null;
  hcUnitPrice: Prisma.Decimal | null;
  fixedCharge: Prisma.Decimal;
  taxPercent: Prisma.Decimal;
  lateFeePercent: Prisma.Decimal;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  deletedAt?: Date | null;
  taxes: Array<{
    sortOrder: number;
    taxRule: {
      code: string;
      name: string;
      type: TaxRuleType;
      applicationScope: TaxApplicationScope;
      value: Prisma.Decimal;
      effectiveFrom: Date | null;
      effectiveTo: Date | null;
      isActive: boolean;
      deletedAt: Date | null;
    };
  }>;
};

function toTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function toDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toDecimal(value: number, scale = 3) {
  const factor = 10 ** scale;
  return new Prisma.Decimal(Math.round(value * factor) / factor);
}

function decimalToNumber(value: Prisma.Decimal | null | undefined) {
  if (!value) return 0;
  return Number(value.toString());
}

function formatPerson(person?: {
  firstName: string | null;
  lastName: string | null;
  username?: string | null;
  phone?: string | null;
} | null) {
  if (!person) return null;
  return (
    [person.firstName, person.lastName].filter(Boolean).join(" ").trim() ||
    person.username ||
    person.phone ||
    null
  );
}

function rangesOverlap(
  startA: Date,
  endA: Date | null | undefined,
  startB: Date,
  endB: Date | null | undefined,
) {
  const effectiveEndA = endA ?? new Date("9999-12-31T23:59:59.999Z");
  const effectiveEndB = endB ?? new Date("9999-12-31T23:59:59.999Z");
  return startA <= effectiveEndB && startB <= effectiveEndA;
}

function fullyCoversPeriod(
  start: Date,
  end: Date,
  coveringStart: Date,
  coveringEnd: Date | null | undefined,
) {
  if (coveringStart > start) return false;
  if (coveringEnd && coveringEnd < end) return false;
  return true;
}

function bandMatches(value: number, min: Prisma.Decimal | null, max: Prisma.Decimal | null) {
  const minimum = min ? decimalToNumber(min) : null;
  const maximum = max ? decimalToNumber(max) : null;
  if (minimum !== null && value < minimum) return false;
  if (maximum !== null && value > maximum) return false;
  return true;
}

function bandWidth(min: Prisma.Decimal | null, max: Prisma.Decimal | null) {
  const minimum = min ? decimalToNumber(min) : 0;
  const maximum = max ? decimalToNumber(max) : Number.POSITIVE_INFINITY;
  return maximum - minimum;
}

function sameScope(
  existing: {
    zoneId: string | null;
    billingMode: TariffBillingMode;
    usageCategory: ServiceUsageCategory;
    subscribedPowerUnit: ServicePowerUnit;
    phaseType: ServicePhaseType | null;
  },
  candidate: {
    zoneId: string | null;
    billingMode: TariffBillingMode;
    usageCategory: ServiceUsageCategory;
    subscribedPowerUnit: ServicePowerUnit;
    phaseType: ServicePhaseType | null;
  },
) {
  return (
    existing.zoneId === candidate.zoneId &&
    existing.billingMode === candidate.billingMode &&
    existing.usageCategory === candidate.usageCategory &&
    existing.subscribedPowerUnit === candidate.subscribedPowerUnit &&
    existing.phaseType === candidate.phaseType
  );
}

export function deriveServiceContractStatus(contract: {
  effectiveFrom: Date;
  effectiveTo: Date | null;
}) {
  const now = new Date();
  if (contract.effectiveTo && contract.effectiveTo < now) return "ENDED" as const;
  if (contract.effectiveFrom > now) return "PENDING" as const;
  return "ACTIVE" as const;
}

async function assertMatchingAssignmentCoverage(
  tx: Prisma.TransactionClient,
  meterId: string,
  periodStart: Date,
  periodEnd: Date | null,
) {
  const assignments = await tx.meterAssignment.findMany({
    where: {
      meterId,
      deletedAt: null,
      assignedAt: { lte: periodEnd ?? new Date("9999-12-31T23:59:59.999Z") },
      OR: [{ endedAt: null }, { endedAt: { gte: periodStart } }],
    },
    orderBy: [{ assignedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      customerId: true,
      assignedAt: true,
      endedAt: true,
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          phone: true,
        },
      },
    },
  });

  const contractEnd = periodEnd ?? periodStart;
  const covering = assignments.filter((assignment) =>
    fullyCoversPeriod(periodStart, contractEnd, assignment.assignedAt, assignment.endedAt)
  );

  if (covering.length === 0) {
    throw new Error("contract_requires_matching_assignment");
  }

  if (covering.length > 1) {
    throw new Error("multiple_assignments_cover_cycle");
  }

  const active = covering[0];
  const overlappingOthers = assignments.filter(
    (assignment) =>
      assignment.id !== active.id &&
      rangesOverlap(periodStart, contractEnd, assignment.assignedAt, assignment.endedAt)
  );

  if (overlappingOthers.length > 0) {
    throw new Error("customer_changed_during_cycle");
  }

  return active;
}

async function assertNoOverlappingContract(
  tx: Prisma.TransactionClient,
  meterId: string,
  customerId: string,
  periodStart: Date,
  periodEnd: Date | null,
  ignoreContractId?: string,
) {
  const overlaps = await tx.serviceContract.findMany({
    where: {
      meterId,
      customerId,
      deletedAt: null,
      ...(ignoreContractId ? { id: { not: ignoreContractId } } : {}),
      effectiveFrom: { lte: periodEnd ?? new Date("9999-12-31T23:59:59.999Z") },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
    },
    select: { id: true },
  });

  if (overlaps.length > 0) {
    throw new Error("overlapping_service_contract");
  }
}

type TariffScopeConflictInput = {
  zoneId: string | null;
  billingMode: TariffBillingMode;
  usageCategory: ServiceUsageCategory;
  subscribedPowerUnit: ServicePowerUnit;
  phaseType: ServicePhaseType | null;
  subscribedPowerMin: number | null;
  subscribedPowerMax: number | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
};

async function assertNoTariffConflict(
  tx: Prisma.TransactionClient,
  payload: TariffScopeConflictInput,
  ignoreTariffPlanId?: string,
) {
  const potentialConflicts = await tx.tariffPlan.findMany({
    where: {
      deletedAt: null,
      ...(ignoreTariffPlanId ? { id: { not: ignoreTariffPlanId } } : {}),
    },
    select: {
      id: true,
      zoneId: true,
      billingMode: true,
      usageCategory: true,
      subscribedPowerUnit: true,
      phaseType: true,
      subscribedPowerMin: true,
      subscribedPowerMax: true,
      effectiveFrom: true,
      effectiveTo: true,
    },
  });

  const conflicting = potentialConflicts.find((plan) => {
    if (
      !sameScope(plan, {
        zoneId: payload.zoneId,
        billingMode: payload.billingMode,
        usageCategory: payload.usageCategory,
        subscribedPowerUnit: payload.subscribedPowerUnit,
        phaseType: payload.phaseType,
      })
    ) {
      return false;
    }

    if (
      !rangesOverlap(
        payload.effectiveFrom ?? new Date("1970-01-01T00:00:00.000Z"),
        payload.effectiveTo ?? null,
        plan.effectiveFrom ?? new Date("1970-01-01T00:00:00.000Z"),
        plan.effectiveTo ?? null,
      )
    ) {
      return false;
    }

    const candidateMin =
      payload.subscribedPowerMin === null || payload.subscribedPowerMin === undefined
        ? null
        : payload.subscribedPowerMin;
    const candidateMax =
      payload.subscribedPowerMax === null || payload.subscribedPowerMax === undefined
        ? null
        : payload.subscribedPowerMax;
    const existingMin = plan.subscribedPowerMin ? decimalToNumber(plan.subscribedPowerMin) : null;
    const existingMax = plan.subscribedPowerMax ? decimalToNumber(plan.subscribedPowerMax) : null;

    const minA = candidateMin ?? Number.NEGATIVE_INFINITY;
    const maxA = candidateMax ?? Number.POSITIVE_INFINITY;
    const minB = existingMin ?? Number.NEGATIVE_INFINITY;
    const maxB = existingMax ?? Number.POSITIVE_INFINITY;

    return minA <= maxB && minB <= maxA;
  });

  if (conflicting) {
    throw new Error("tariff_plan_scope_conflict");
  }
}

export async function validateTariffPlanScopeConflict(
  payload: TariffScopeConflictInput,
  ignoreTariffPlanId?: string,
) {
  await prisma.$transaction(async (tx) => {
    await assertNoTariffConflict(tx, payload, ignoreTariffPlanId);
  });
}

export async function createServiceContract(staff: StaffUser, payload: CreateServiceContractInput) {
  const meterId = toTrimmed(payload.meterId);
  const contractNumber = toTrimmed(payload.contractNumber);
  const policeNumber = toTrimmed(payload.policeNumber);
  const effectiveFrom = toDate(payload.effectiveFrom);
  const effectiveTo = toDate(payload.effectiveTo);
  const notes = toTrimmed(payload.notes);
  const subscribedPowerValue = toNumber(payload.subscribedPowerValue);
  const usageCategory = payload.usageCategory ?? null;
  const billingMode = payload.billingMode ?? null;
  const subscribedPowerUnit = payload.subscribedPowerUnit ?? ServicePowerUnit.AMPERE;
  const phaseType = payload.phaseType ?? ServicePhaseType.SINGLE_PHASE;

  if (!meterId || !effectiveFrom || subscribedPowerValue === null || subscribedPowerValue <= 0) {
    return { status: 400, body: { error: "service_contract_required_fields" } };
  }
  if (!usageCategory || !billingMode) {
    return { status: 400, body: { error: "service_contract_profile_required" } };
  }
  if (effectiveTo && effectiveTo <= effectiveFrom) {
    return { status: 400, body: { error: "invalid_contract_period" } };
  }

  try {
    const contract = await prisma.$transaction(async (tx) => {
      const meter = await tx.meter.findFirst({
        where: { id: meterId, deletedAt: null },
        select: { id: true },
      });
      if (!meter) {
        throw new Error("meter_not_found");
      }

      const assignment = await assertMatchingAssignmentCoverage(tx, meterId, effectiveFrom, effectiveTo);
      await assertNoOverlappingContract(tx, meterId, assignment.customerId, effectiveFrom, effectiveTo);

      return tx.serviceContract.create({
        data: {
          meterId,
          customerId: assignment.customerId,
          createdById: staff.id,
          contractNumber,
          policeNumber,
          usageCategory,
          billingMode,
          subscribedPowerValue: toDecimal(subscribedPowerValue),
          subscribedPowerUnit,
          phaseType,
          effectiveFrom,
          effectiveTo,
          notes,
        },
        include: {
          meter: { select: { id: true, serialNumber: true, meterReference: true, city: true, zone: true } },
          customer: {
            select: { id: true, firstName: true, lastName: true, username: true, phone: true },
          },
        },
      });
    });

    return { status: 201, body: { message: "service_contract_created", contract } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: 409, body: { error: "service_contract_identifier_exists" } };
    }

    const message = error instanceof Error ? error.message : "failed_to_create_service_contract";
    if (
      message === "meter_not_found" ||
      message === "contract_requires_matching_assignment" ||
      message === "overlapping_service_contract" ||
      message === "customer_changed_during_cycle" ||
      message === "multiple_assignments_cover_cycle"
    ) {
      return { status: 400, body: { error: message } };
    }

    return { status: 500, body: { error: "failed_to_create_service_contract" } };
  }
}

export async function closeServiceContract(staff: StaffUser, contractId: string, effectiveToInput?: string | null) {
  const effectiveTo = toDate(effectiveToInput) ?? new Date();

  const existing = await prisma.serviceContract.findFirst({
    where: { id: contractId, deletedAt: null },
    select: { id: true, effectiveFrom: true, effectiveTo: true },
  });

  if (!existing) {
    return { status: 404, body: { error: "service_contract_not_found" } };
  }

  if (effectiveTo <= existing.effectiveFrom) {
    return { status: 400, body: { error: "invalid_contract_period" } };
  }

  const updated = await prisma.serviceContract.update({
    where: { id: contractId },
    data: {
      effectiveTo,
      endedById: staff.id,
    },
  });

  return { status: 200, body: { message: "service_contract_closed", contract: updated } };
}

export async function closeActiveServiceContractsForMeter(
  tx: Prisma.TransactionClient,
  params: {
    meterId: string;
    endedById?: string | null;
    effectiveTo?: Date;
  },
) {
  const effectiveTo = params.effectiveTo ?? new Date();
  const activeContracts = await tx.serviceContract.findMany({
    where: {
      meterId: params.meterId,
      deletedAt: null,
      effectiveFrom: { lte: effectiveTo },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveTo } }],
    },
    select: { id: true, effectiveFrom: true },
  });

  for (const contract of activeContracts) {
    if (effectiveTo <= contract.effectiveFrom) {
      continue;
    }
    await tx.serviceContract.update({
      where: { id: contract.id },
      data: {
        effectiveTo,
        endedById: params.endedById ?? null,
      },
    });
  }

  return activeContracts.length;
}

export async function listServiceContracts(filters: {
  search?: string;
  page?: number;
  perPage?: number;
  status?: string;
}) {
  const page = Math.max(1, Number(filters.page || 1));
  const perPage = Math.min(100, Math.max(10, Number(filters.perPage || 20)));
  const search = toTrimmed(filters.search);
  const status = toTrimmed(filters.status)?.toUpperCase();
  const now = new Date();

  const where: Prisma.ServiceContractWhereInput = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { contractNumber: { contains: search, mode: "insensitive" } },
            { policeNumber: { contains: search, mode: "insensitive" } },
            { meter: { serialNumber: { contains: search, mode: "insensitive" } } },
            { meter: { meterReference: { contains: search, mode: "insensitive" } } },
            { customer: { phone: { contains: search, mode: "insensitive" } } },
            { customer: { username: { contains: search, mode: "insensitive" } } },
            { customer: { firstName: { contains: search, mode: "insensitive" } } },
            { customer: { lastName: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(status === "ACTIVE"
      ? { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }
      : {}),
    ...(status === "PENDING" ? { effectiveFrom: { gt: now } } : {}),
    ...(status === "ENDED" ? { effectiveTo: { lt: now } } : {}),
  };

  const [total, contracts] = await prisma.$transaction([
    prisma.serviceContract.count({ where }),
    prisma.serviceContract.findMany({
      where,
      include: {
        meter: { select: { id: true, serialNumber: true, meterReference: true, city: true, zone: true } },
        customer: {
          select: { id: true, firstName: true, lastName: true, username: true, phone: true },
        },
        createdBy: { select: { firstName: true, lastName: true, username: true } },
        endedBy: { select: { firstName: true, lastName: true, username: true } },
        _count: { select: { invoices: true } },
      },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  return {
    status: 200,
    body: {
      total,
      page,
      perPage,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      contracts: contracts.map((contract) => ({
        ...contract,
        derivedStatus: deriveServiceContractStatus(contract),
        customerLabel: formatPerson(contract.customer) || contract.customer.phone || contract.customer.id,
        createdByLabel: formatPerson(contract.createdBy),
        endedByLabel: formatPerson(contract.endedBy),
      })),
    },
  };
}

export function resolveBillingAssignmentForPeriod(
  assignments: BillingAssignmentRecord[],
  periodStart: Date,
  periodEnd: Date,
) {
  const relevant = assignments.filter((assignment) =>
    rangesOverlap(periodStart, periodEnd, assignment.assignedAt, assignment.endedAt)
  );
  const covering = relevant.filter((assignment) =>
    fullyCoversPeriod(periodStart, periodEnd, assignment.assignedAt, assignment.endedAt)
  );

  if (covering.length === 0) {
    return { ok: false as const, error: "assignment_missing_for_cycle" };
  }
  if (covering.length > 1) {
    return { ok: false as const, error: "multiple_assignments_cover_cycle" };
  }

  const chosen = covering[0];
  const otherOverlaps = relevant.filter((assignment) => assignment.id !== chosen.id);
  if (otherOverlaps.length > 0) {
    return { ok: false as const, error: "customer_changed_during_cycle" };
  }

  return { ok: true as const, assignment: chosen };
}

export function resolveServiceContractForPeriod(
  contracts: BillingContractRecord[],
  customerId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  const relevant = contracts.filter(
    (contract) =>
      contract.customerId === customerId &&
      rangesOverlap(periodStart, periodEnd, contract.effectiveFrom, contract.effectiveTo)
  );
  const covering = relevant.filter((contract) =>
    fullyCoversPeriod(periodStart, periodEnd, contract.effectiveFrom, contract.effectiveTo)
  );

  if (covering.length === 0) {
    return { ok: false as const, error: "contract_missing_for_cycle" };
  }
  if (covering.length > 1) {
    return { ok: false as const, error: "multiple_contracts_cover_cycle" };
  }

  const chosen = covering[0];
  const otherOverlaps = relevant.filter((contract) => contract.id !== chosen.id);
  if (otherOverlaps.length > 0) {
    return { ok: false as const, error: "contract_changed_during_cycle" };
  }

  return { ok: true as const, contract: chosen };
}

export function resolveTariffPlanForContract(params: {
  tariffPlans: BillingTariffRecord[];
  preferredTariffPlanId?: string | null;
  meterZoneId?: string | null;
  meterType: MeterType;
  periodStart: Date;
  periodEnd: Date;
  contract: BillingContractRecord;
}) {
  const { tariffPlans, preferredTariffPlanId, meterZoneId = null, meterType, periodStart, periodEnd, contract } =
    params;

  if (contract.billingMode === TariffBillingMode.TIME_OF_USE && meterType !== MeterType.DUAL_INDEX) {
    return { ok: false as const, error: "time_of_use_requires_dual_index_meter" };
  }

  const subscribedPower = decimalToNumber(contract.subscribedPowerValue);

  const candidates = tariffPlans.filter((plan) => {
    if (!fullyCoversPeriod(periodStart, periodEnd, plan.effectiveFrom ?? new Date("1970-01-01T00:00:00.000Z"), plan.effectiveTo)) {
      return false;
    }
    if (plan.zoneId && plan.zoneId !== meterZoneId) return false;
    if (plan.billingMode !== contract.billingMode) return false;
    if (plan.usageCategory !== contract.usageCategory) return false;
    if (plan.subscribedPowerUnit !== contract.subscribedPowerUnit) return false;
    if (plan.phaseType && plan.phaseType !== contract.phaseType) return false;
    if (!bandMatches(subscribedPower, plan.subscribedPowerMin, plan.subscribedPowerMax)) return false;
    if (plan.billingMode === TariffBillingMode.TIME_OF_USE && meterType !== MeterType.DUAL_INDEX) return false;
    return true;
  });

  if (candidates.length === 0) {
    return { ok: false as const, error: "tariff_plan_not_found_for_contract" };
  }

  const scored = candidates
    .map((plan) => ({
      plan,
      isPreferred: preferredTariffPlanId ? plan.id === preferredTariffPlanId : false,
      zoneScore: plan.zoneId ? 1 : 0,
      phaseScore: plan.phaseType ? 1 : 0,
      bandScore:
        plan.subscribedPowerMin !== null || plan.subscribedPowerMax !== null ? 1 : 0,
      bandWidth: bandWidth(plan.subscribedPowerMin, plan.subscribedPowerMax),
      effectiveScore: plan.effectiveFrom ? plan.effectiveFrom.getTime() : 0,
    }))
    .sort((left, right) => {
      if (left.zoneScore !== right.zoneScore) return right.zoneScore - left.zoneScore;
      if (left.phaseScore !== right.phaseScore) return right.phaseScore - left.phaseScore;
      if (left.bandScore !== right.bandScore) return right.bandScore - left.bandScore;
      if (left.bandWidth !== right.bandWidth) return left.bandWidth - right.bandWidth;
      if (left.isPreferred !== right.isPreferred) return left.isPreferred ? -1 : 1;
      return right.effectiveScore - left.effectiveScore;
    });

  const [winner, runnerUp] = scored;
  if (runnerUp) {
    const samePriority =
      winner.isPreferred === runnerUp.isPreferred &&
      winner.zoneScore === runnerUp.zoneScore &&
      winner.phaseScore === runnerUp.phaseScore &&
      winner.bandScore === runnerUp.bandScore &&
      winner.bandWidth === runnerUp.bandWidth &&
      winner.effectiveScore === runnerUp.effectiveScore;
    if (samePriority) {
      return { ok: false as const, error: "multiple_tariffs_match_contract" };
    }
  }

  return { ok: true as const, plan: winner.plan };
}

export type BillingAssignmentResolution = ReturnType<typeof resolveBillingAssignmentForPeriod>;
export type BillingContractResolution = ReturnType<typeof resolveServiceContractForPeriod>;
export type BillingTariffResolution = ReturnType<typeof resolveTariffPlanForContract>;

export const serviceContractBillingSelect = {
  id: true,
  meterId: true,
  customerId: true,
  contractNumber: true,
  policeNumber: true,
  usageCategory: true,
  billingMode: true,
  subscribedPowerValue: true,
  subscribedPowerUnit: true,
  phaseType: true,
  effectiveFrom: true,
  effectiveTo: true,
  notes: true,
} satisfies Prisma.ServiceContractSelect;

export const billingMeterAssignmentSelect = {
  id: true,
  meterId: true,
  customerId: true,
  assignedAt: true,
  endedAt: true,
  customer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      phone: true,
    },
  },
} satisfies Prisma.MeterAssignmentSelect;
