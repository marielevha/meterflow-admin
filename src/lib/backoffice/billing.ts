import {
  BillingCampaignStatus,
  DeliveryChannel,
  DeliveryStatus,
  InvoiceLineType,
  InvoiceStatus,
  PaymentMethod,
  Prisma,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings/serverSettings";

type StaffUser = {
  id: string;
  role: UserRole;
};

type CreateTariffTierInput = {
  minConsumption: number;
  maxConsumption?: number | null;
  unitPrice: number;
};

type CreateTariffPlanInput = {
  code?: string;
  name?: string;
  description?: string;
  currency?: string;
  fixedCharge?: number;
  taxPercent?: number;
  lateFeePercent?: number;
  isDefault?: boolean;
  tiers?: CreateTariffTierInput[];
};

type UpdateTariffPlanInput = Partial<CreateTariffPlanInput> & {
  isActive?: boolean;
};

type CreateCampaignInput = {
  code?: string;
  name?: string;
  periodStart?: string;
  periodEnd?: string;
  submissionStartAt?: string;
  submissionEndAt?: string;
  cutoffAt?: string;
  frequency?: string;
  city?: string;
  zone?: string;
  tariffPlanId?: string;
  notes?: string;
};

type InvoiceFilters = {
  status?: string;
  campaignId?: string;
  customerId?: string;
  city?: string;
  zone?: string;
  search?: string;
  page?: number;
  perPage?: number;
};

type RegisterPaymentPayload = {
  amount?: number;
  method?: PaymentMethod;
  reference?: string;
  paidAt?: string;
};

type TriggerDeliveryPayload = {
  channel?: DeliveryChannel;
  recipient?: string;
};

const TAX_SCALE = 2;
const M3_SCALE = 3;
const ISSUABLE_INVOICE_STATUSES = new Set<InvoiceStatus>([
  InvoiceStatus.DRAFT,
  InvoiceStatus.PENDING_REVIEW,
]);
const DELIVERABLE_INVOICE_STATUSES = new Set<InvoiceStatus>([
  InvoiceStatus.ISSUED,
  InvoiceStatus.DELIVERED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.PAID,
]);
const FINANCE_STAFF_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.SUPERVISOR]);
const BASELINE_INVOICE_STATUSES = [
  InvoiceStatus.ISSUED,
  InvoiceStatus.DELIVERED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.PAID,
  InvoiceStatus.OVERDUE,
];

function toTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function round(value: number, scale = TAX_SCALE): number {
  const factor = 10 ** scale;
  return Math.round(value * factor) / factor;
}

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  if (!value) return 0;
  return Number(value.toString());
}

function toDecimal(value: number, scale = TAX_SCALE) {
  return new Prisma.Decimal(round(value, scale));
}

function normalizeTiers(tiers: CreateTariffTierInput[]) {
  const sanitized = tiers
    .map((tier) => ({
      minConsumption: round(toNumber(tier.minConsumption), M3_SCALE),
      maxConsumption:
        tier.maxConsumption === null || tier.maxConsumption === undefined
          ? null
          : round(toNumber(tier.maxConsumption), M3_SCALE),
      unitPrice: round(toNumber(tier.unitPrice), M3_SCALE),
    }))
    .sort((a, b) => a.minConsumption - b.minConsumption);

  for (let i = 0; i < sanitized.length; i += 1) {
    const current = sanitized[i];
    if (current.minConsumption < 0 || current.unitPrice < 0) {
      return { ok: false as const, error: "invalid_tier_values" };
    }
    if (current.maxConsumption !== null && current.maxConsumption < current.minConsumption) {
      return { ok: false as const, error: "invalid_tier_range" };
    }
    const next = sanitized[i + 1];
    if (next && current.maxConsumption !== null && next.minConsumption < current.maxConsumption) {
      return { ok: false as const, error: "overlapping_tiers" };
    }
  }

  return { ok: true as const, tiers: sanitized };
}

function assertAdmin(user: StaffUser) {
  if (user.role !== UserRole.ADMIN) {
    return { ok: false as const, status: 403, body: { error: "admin_only_endpoint" } };
  }
  return { ok: true as const };
}

async function resolveTariffPlanId(inputTariffPlanId?: string | null) {
  if (inputTariffPlanId) {
    const plan = await prisma.tariffPlan.findFirst({
      where: { id: inputTariffPlanId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    return plan?.id || null;
  }

  const defaultPlan = await prisma.tariffPlan.findFirst({
    where: { deletedAt: null, isDefault: true, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (defaultPlan) return defaultPlan.id;

  const anyPlan = await prisma.tariffPlan.findFirst({
    where: { deletedAt: null, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return anyPlan?.id || null;
}

async function generateInvoiceNumber(periodDate: Date) {
  const yyyy = periodDate.getUTCFullYear();
  const mm = String(periodDate.getUTCMonth() + 1).padStart(2, "0");
  const prefix = `INV-${yyyy}${mm}`;
  const start = new Date(Date.UTC(yyyy, periodDate.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(yyyy, periodDate.getUTCMonth() + 1, 1, 0, 0, 0));

  const count = await prisma.invoice.count({
    where: {
      createdAt: { gte: start, lt: end },
    },
  });
  const seq = String(count + 1).padStart(6, "0");
  return `${prefix}-${seq}`;
}

type TariffChargeLine = {
  label: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

function computeConsumptionCharge(
  consumption: number,
  tiers: Array<{ minConsumption: Prisma.Decimal; maxConsumption: Prisma.Decimal | null; unitPrice: Prisma.Decimal }>
) {
  const lines: TariffChargeLine[] = [];
  let total = 0;

  for (const tier of tiers) {
    const min = decimalToNumber(tier.minConsumption);
    const max = tier.maxConsumption ? decimalToNumber(tier.maxConsumption) : Number.POSITIVE_INFINITY;
    const unitPrice = decimalToNumber(tier.unitPrice);

    if (consumption <= min) continue;
    const qty = Math.max(0, Math.min(consumption, max) - min);
    if (qty <= 0) continue;

    const amount = round(qty * unitPrice, TAX_SCALE);
    lines.push({
      label: `Consumption ${min} - ${Number.isFinite(max) ? max : "INF"}`,
      quantity: round(qty, M3_SCALE),
      unitPrice: round(unitPrice, M3_SCALE),
      amount,
    });
    total += amount;
  }

  return { lines, total: round(total, TAX_SCALE) };
}

export async function listTariffPlans() {
  const plans = await prisma.tariffPlan.findMany({
    where: { deletedAt: null },
    include: {
      tiers: {
        where: { deletedAt: null },
        orderBy: { minConsumption: "asc" },
      },
      _count: { select: { invoices: true, campaigns: true } },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return { status: 200, body: { plans } };
}

export async function createTariffPlan(staff: StaffUser, payload: CreateTariffPlanInput) {
  const admin = assertAdmin(staff);
  if (!admin.ok) return admin;

  const code = toTrimmed(payload.code)?.toUpperCase();
  const name = toTrimmed(payload.name);
  const description = toTrimmed(payload.description);
  const currency = toTrimmed(payload.currency)?.toUpperCase() || "XAF";
  const fixedCharge = Math.max(0, toNumber(payload.fixedCharge));
  const taxPercent = Math.max(0, toNumber(payload.taxPercent));
  const lateFeePercent = Math.max(0, toNumber(payload.lateFeePercent));
  const isDefault = Boolean(payload.isDefault);
  const tiersInput = Array.isArray(payload.tiers) ? payload.tiers : [];

  if (!code || !name) {
    return { status: 400, body: { error: "code_and_name_required" } };
  }
  if (tiersInput.length === 0) {
    return { status: 400, body: { error: "tiers_required" } };
  }

  const tiersNormalized = normalizeTiers(tiersInput);
  if (!tiersNormalized.ok) {
    return { status: 400, body: { error: tiersNormalized.error } };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.tariffPlan.updateMany({
          where: { isDefault: true, deletedAt: null },
          data: { isDefault: false },
        });
      }

      return tx.tariffPlan.create({
        data: {
          code,
          name,
          description,
          currency,
          fixedCharge: toDecimal(fixedCharge),
          taxPercent: toDecimal(taxPercent),
          lateFeePercent: toDecimal(lateFeePercent),
          isDefault,
          tiers: {
            create: tiersNormalized.tiers.map((tier) => ({
              minConsumption: toDecimal(tier.minConsumption, M3_SCALE),
              maxConsumption:
                tier.maxConsumption === null ? null : toDecimal(tier.maxConsumption, M3_SCALE),
              unitPrice: toDecimal(tier.unitPrice, M3_SCALE),
            })),
          },
        },
        include: {
          tiers: { where: { deletedAt: null }, orderBy: { minConsumption: "asc" } },
        },
      });
    });

    return { status: 201, body: { message: "tariff_plan_created", plan: created } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: 409, body: { error: "tariff_code_already_exists" } };
    }
    return { status: 500, body: { error: "failed_to_create_tariff_plan" } };
  }
}

export async function updateTariffPlan(
  staff: StaffUser,
  tariffPlanId: string,
  payload: UpdateTariffPlanInput
) {
  const admin = assertAdmin(staff);
  if (!admin.ok) return admin;

  const existing = await prisma.tariffPlan.findFirst({
    where: { id: tariffPlanId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return { status: 404, body: { error: "tariff_plan_not_found" } };

  const hasTierPayload = Array.isArray(payload.tiers);
  if (hasTierPayload) {
    const normalized = normalizeTiers(payload.tiers || []);
    if (!normalized.ok) return { status: 400, body: { error: normalized.error } };

    const updated = await prisma.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.tariffPlan.updateMany({
          where: { isDefault: true, deletedAt: null, id: { not: tariffPlanId } },
          data: { isDefault: false },
        });
      }

      await tx.tariffTier.updateMany({
        where: { tariffPlanId, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      return tx.tariffPlan.update({
        where: { id: tariffPlanId },
        data: {
          code: toTrimmed(payload.code)?.toUpperCase() || undefined,
          name: toTrimmed(payload.name) || undefined,
          description: payload.description !== undefined ? toTrimmed(payload.description) : undefined,
          currency: toTrimmed(payload.currency)?.toUpperCase() || undefined,
          fixedCharge:
            payload.fixedCharge !== undefined
              ? toDecimal(Math.max(0, toNumber(payload.fixedCharge)))
              : undefined,
          taxPercent:
            payload.taxPercent !== undefined
              ? toDecimal(Math.max(0, toNumber(payload.taxPercent)))
              : undefined,
          lateFeePercent:
            payload.lateFeePercent !== undefined
              ? toDecimal(Math.max(0, toNumber(payload.lateFeePercent)))
              : undefined,
          isDefault: payload.isDefault,
          isActive: payload.isActive,
          tiers: {
            create: normalized.tiers.map((tier) => ({
              minConsumption: toDecimal(tier.minConsumption, M3_SCALE),
              maxConsumption:
                tier.maxConsumption === null ? null : toDecimal(tier.maxConsumption, M3_SCALE),
              unitPrice: toDecimal(tier.unitPrice, M3_SCALE),
            })),
          },
        },
        include: {
          tiers: { where: { deletedAt: null }, orderBy: { minConsumption: "asc" } },
        },
      });
    });

    return { status: 200, body: { message: "tariff_plan_updated", plan: updated } };
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (payload.isDefault) {
      await tx.tariffPlan.updateMany({
        where: { isDefault: true, deletedAt: null, id: { not: tariffPlanId } },
        data: { isDefault: false },
      });
    }

    return tx.tariffPlan.update({
      where: { id: tariffPlanId },
      data: {
        code: toTrimmed(payload.code)?.toUpperCase() || undefined,
        name: toTrimmed(payload.name) || undefined,
        description: payload.description !== undefined ? toTrimmed(payload.description) : undefined,
        currency: toTrimmed(payload.currency)?.toUpperCase() || undefined,
        fixedCharge:
          payload.fixedCharge !== undefined
            ? toDecimal(Math.max(0, toNumber(payload.fixedCharge)))
            : undefined,
        taxPercent:
          payload.taxPercent !== undefined
            ? toDecimal(Math.max(0, toNumber(payload.taxPercent)))
            : undefined,
        lateFeePercent:
          payload.lateFeePercent !== undefined
            ? toDecimal(Math.max(0, toNumber(payload.lateFeePercent)))
            : undefined,
        isDefault: payload.isDefault,
        isActive: payload.isActive,
      },
      include: {
        tiers: { where: { deletedAt: null }, orderBy: { minConsumption: "asc" } },
      },
    });
  });

  return { status: 200, body: { message: "tariff_plan_updated", plan: updated } };
}

export async function listBillingCampaigns() {
  const campaigns = await prisma.billingCampaign.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      periodStart: true,
      periodEnd: true,
      city: true,
      zone: true,
      status: true,
      tariffPlan: { select: { id: true, code: true, name: true } },
      _count: { select: { invoices: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });
  return { status: 200, body: { campaigns } };
}

export async function createBillingCampaign(staff: StaffUser, payload: CreateCampaignInput) {
  const admin = assertAdmin(staff);
  if (!admin.ok) return admin;

  const code = toTrimmed(payload.code)?.toUpperCase();
  const name = toTrimmed(payload.name);
  const periodStart = toDate(payload.periodStart);
  const periodEnd = toDate(payload.periodEnd);
  const submissionStartAt = toDate(payload.submissionStartAt);
  const submissionEndAt = toDate(payload.submissionEndAt);
  const cutoffAt = toDate(payload.cutoffAt);
  const frequency = toTrimmed(payload.frequency) || "MONTHLY";
  const city = toTrimmed(payload.city);
  const zone = toTrimmed(payload.zone);
  const notes = toTrimmed(payload.notes);

  if (!code || !name || !periodStart || !periodEnd) {
    return { status: 400, body: { error: "code_name_period_required" } };
  }
  if (periodEnd <= periodStart) {
    return { status: 400, body: { error: "invalid_period_range" } };
  }
  const effectiveSubmissionStart = submissionStartAt ?? periodStart;
  const effectiveSubmissionEnd = submissionEndAt ?? periodEnd;
  const effectiveCutoff = cutoffAt ?? periodEnd;
  if (effectiveSubmissionEnd < effectiveSubmissionStart) {
    return { status: 400, body: { error: "invalid_submission_window" } };
  }
  if (effectiveCutoff < effectiveSubmissionStart) {
    return { status: 400, body: { error: "invalid_cutoff" } };
  }

  const tariffPlanId = await resolveTariffPlanId(toTrimmed(payload.tariffPlanId));
  if (!tariffPlanId) {
    return { status: 400, body: { error: "active_tariff_plan_required" } };
  }

  const settings = await getAppSettings();

  try {
    const campaign = await prisma.billingCampaign.create({
      data: {
        code,
        name,
        periodStart,
        periodEnd,
        submissionStartAt: effectiveSubmissionStart,
        submissionEndAt: effectiveSubmissionEnd,
        cutoffAt: effectiveCutoff,
        frequency,
        city,
        zone,
        notes,
        tariffPlanId,
        createdById: staff.id,
        settingsSnapshot: settings,
      },
      include: { tariffPlan: { select: { id: true, code: true, name: true } } },
    });
    return { status: 201, body: { message: "billing_campaign_created", campaign } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: 409, body: { error: "campaign_code_already_exists" } };
    }
    return { status: 500, body: { error: "failed_to_create_campaign" } };
  }
}

export async function generateCampaignInvoices(staff: StaffUser, campaignId: string) {
  const admin = assertAdmin(staff);
  if (!admin.ok) return admin;

  const campaign = await prisma.billingCampaign.findFirst({
    where: { id: campaignId, deletedAt: null },
    include: {
      tariffPlan: {
        include: {
          tiers: {
            where: { deletedAt: null },
            orderBy: { minConsumption: "asc" },
          },
        },
      },
    },
  });
  if (!campaign) return { status: 404, body: { error: "campaign_not_found" } };
  if (!campaign.tariffPlan || !campaign.tariffPlan.isActive || campaign.tariffPlan.deletedAt) {
    return { status: 400, body: { error: "tariff_plan_not_available" } };
  }
  const tariffPlan = campaign.tariffPlan;
  if (campaign.finalizedAt) {
    return { status: 409, body: { error: "campaign_cycle_finalized" } };
  }
  if (campaign.status === BillingCampaignStatus.ISSUED || campaign.status === BillingCampaignStatus.CLOSED) {
    return { status: 409, body: { error: "campaign_not_generatable" } };
  }

  const submissionStart = campaign.submissionStartAt ?? campaign.periodStart;
  const submissionEnd = campaign.submissionEndAt ?? campaign.periodEnd;
  const cutoffAt = campaign.cutoffAt ?? campaign.periodEnd;

  const meters = await prisma.meter.findMany({
    where: {
      deletedAt: null,
      status: { in: ["ACTIVE", "REPLACED"] },
      ...(campaign.city ? { city: campaign.city } : {}),
      ...(campaign.zone ? { zone: campaign.zone } : {}),
    },
    select: {
      id: true,
      customerId: true,
      serialNumber: true,
      status: true,
    },
  });

  let createdCount = 0;
  let skippedCount = 0;

  for (const meter of meters) {
    const reading = await prisma.reading.findFirst({
      where: {
        meterId: meter.id,
        deletedAt: null,
        status: "VALIDATED",
        readingAt: { gte: submissionStart, lte: cutoffAt },
      },
      orderBy: [{ readingAt: "desc" }, { reviewedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        meterId: true,
        readingAt: true,
        reviewedAt: true,
        primaryIndex: true,
        secondaryIndex: true,
      },
    });

    const existing = await prisma.invoice.findFirst({
      where: {
        campaignId: campaign.id,
        meterId: meter.id,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      skippedCount += 1;
      continue;
    }

    const baselineInvoice = await prisma.invoice.findFirst({
      where: {
        meterId: meter.id,
        deletedAt: null,
        status: { in: BASELINE_INVOICE_STATUSES },
        periodEnd: { lt: campaign.periodStart },
      },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        toReadingId: true,
        sourceReadingId: true,
        toPrimaryIndex: true,
        currentPrimary: true,
        toSecondaryIndex: true,
        currentSecondary: true,
      },
    });

    const baselineState = await prisma.meterState.findFirst({
      where: {
        meterId: meter.id,
        deletedAt: null,
        effectiveAt: { lt: submissionStart },
      },
      orderBy: { effectiveAt: "desc" },
      select: {
        sourceReadingId: true,
        currentPrimary: true,
        currentSecondary: true,
      },
    });

    const fromReadingId =
      baselineInvoice?.toReadingId ||
      baselineInvoice?.sourceReadingId ||
      baselineState?.sourceReadingId ||
      null;
    const fromPrimary = baselineInvoice?.toPrimaryIndex
      ? decimalToNumber(baselineInvoice.toPrimaryIndex)
      : baselineInvoice?.currentPrimary
        ? decimalToNumber(baselineInvoice.currentPrimary)
        : baselineState?.currentPrimary
          ? decimalToNumber(baselineState.currentPrimary)
          : null;
    const fromSecondary = baselineInvoice?.toSecondaryIndex
      ? decimalToNumber(baselineInvoice.toSecondaryIndex)
      : baselineInvoice?.currentSecondary
        ? decimalToNumber(baselineInvoice.currentSecondary)
        : baselineState?.currentSecondary
          ? decimalToNumber(baselineState.currentSecondary)
          : null;

    let toReadingId: string | null = reading?.id || null;
    let toPrimary = reading ? decimalToNumber(reading.primaryIndex) : null;
    const toSecondary =
      reading?.secondaryIndex !== null && reading?.secondaryIndex !== undefined
        ? decimalToNumber(reading.secondaryIndex)
        : null;

    let isEstimated = false;
    let estimationMethod: string | null = null;
    let hasException = false;
    const exceptionReasons: string[] = [];

    if (!reading) {
      isEstimated = true;
      hasException = true;
      estimationMethod = "AVG_LAST_3_CYCLES";
      exceptionReasons.push("missing_validated_reading");
      const recent = await prisma.invoice.findMany({
        where: {
          meterId: meter.id,
          deletedAt: null,
          status: { in: BASELINE_INVOICE_STATUSES },
          isEstimated: false,
        },
        orderBy: { periodEnd: "desc" },
        take: 3,
        select: { consumptionPrimary: true },
      });
      const avg =
        recent.length > 0
          ? recent.reduce((sum, row) => sum + decimalToNumber(row.consumptionPrimary), 0) / recent.length
          : 0;
      const estimatedConsumption = Math.max(0, round(avg, M3_SCALE));
      if (fromPrimary !== null) {
        toPrimary = round(fromPrimary + estimatedConsumption, M3_SCALE);
      }
    }

    if (fromPrimary === null && toPrimary !== null) {
      hasException = true;
      exceptionReasons.push("missing_baseline_reference");
    }

    if (meter.status === "REPLACED") {
      hasException = true;
      exceptionReasons.push("meter_replaced_cycle_break");
    }

    const decreasingIndex = fromPrimary !== null && toPrimary !== null && toPrimary < fromPrimary;
    if (decreasingIndex) {
      hasException = true;
      exceptionReasons.push("decreasing_index_detected");
    }

    const safeFromPrimary = fromPrimary === null ? toPrimary ?? 0 : fromPrimary;
    const safeToPrimary = toPrimary === null ? safeFromPrimary : toPrimary;
    const consumptionPrimary =
      decreasingIndex ? 0 : Math.max(0, round(safeToPrimary - safeFromPrimary, M3_SCALE));

    const charge = computeConsumptionCharge(consumptionPrimary, tariffPlan.tiers);
    const fixedAmount = decimalToNumber(tariffPlan.fixedCharge);
    const subtotal = round(charge.total, TAX_SCALE);
    const taxableBase = round(subtotal + fixedAmount, TAX_SCALE);
    const taxRate = decimalToNumber(tariffPlan.taxPercent);
    const taxAmount = round((taxableBase * taxRate) / 100, TAX_SCALE);
    const totalAmount = round(taxableBase + taxAmount, TAX_SCALE);

    const invoiceNumber = await generateInvoiceNumber(reading?.readingAt ?? cutoffAt);

    await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          campaignId: campaign.id,
          tariffPlanId: campaign.tariffPlanId,
          customerId: meter.customerId,
          meterId: meter.id,
          sourceReadingId: reading?.id ?? null,
          fromReadingId,
          toReadingId,
          generatedById: staff.id,
          status: hasException ? InvoiceStatus.PENDING_REVIEW : InvoiceStatus.DRAFT,
          currency: tariffPlan.currency,
          periodStart: campaign.periodStart,
          periodEnd: campaign.periodEnd,
          dueDate: new Date(campaign.periodEnd.getTime() + 15 * 24 * 60 * 60 * 1000),
          fromPrimaryIndex: toDecimal(safeFromPrimary, M3_SCALE),
          toPrimaryIndex: toDecimal(safeToPrimary, M3_SCALE),
          fromSecondaryIndex: fromSecondary !== null ? toDecimal(fromSecondary, M3_SCALE) : null,
          toSecondaryIndex: toSecondary !== null ? toDecimal(toSecondary, M3_SCALE) : null,
          previousPrimary: toDecimal(safeFromPrimary, M3_SCALE),
          currentPrimary: toDecimal(safeToPrimary, M3_SCALE),
          previousSecondary: fromSecondary !== null ? toDecimal(fromSecondary, M3_SCALE) : null,
          currentSecondary: toSecondary !== null ? toDecimal(toSecondary, M3_SCALE) : null,
          consumptionPrimary: toDecimal(consumptionPrimary, M3_SCALE),
          consumptionSecondary: null,
          isEstimated,
          estimationMethod,
          hasException,
          subtotal: toDecimal(subtotal),
          taxAmount: toDecimal(taxAmount),
          fixedAmount: toDecimal(fixedAmount),
          adjustmentAmount: toDecimal(0),
          totalAmount: toDecimal(totalAmount),
          paidAmount: toDecimal(0),
          metadata: {
            meterSerial: meter.serialNumber,
            taxRate,
            cycle: {
              fromReadingId,
              toReadingId,
              cutoffAt,
              submissionStart,
              submissionEnd,
            },
            exceptionReasons,
          },
        },
      });

      const lines = [
        ...charge.lines.map((line) => ({
          invoiceId: created.id,
          type: InvoiceLineType.CONSUMPTION,
          label: line.label,
          quantity: toDecimal(line.quantity, M3_SCALE),
          unitPrice: toDecimal(line.unitPrice, M3_SCALE),
          amount: toDecimal(line.amount),
        })),
        {
          invoiceId: created.id,
          type: InvoiceLineType.FIXED_FEE,
          label: "Fixed charge",
          quantity: toDecimal(1, M3_SCALE),
          unitPrice: toDecimal(fixedAmount, M3_SCALE),
          amount: toDecimal(fixedAmount),
        },
        {
          invoiceId: created.id,
          type: InvoiceLineType.TAX,
          label: `Tax (${taxRate}%)`,
          quantity: toDecimal(1, M3_SCALE),
          unitPrice: toDecimal(taxAmount, M3_SCALE),
          amount: toDecimal(taxAmount),
        },
      ];
      await tx.invoiceLine.createMany({ data: lines });

      await tx.invoiceEvent.create({
        data: {
          invoiceId: created.id,
          userId: staff.id,
          type: "GENERATED",
          payload: {
            campaignId: campaign.id,
            fromReadingId,
            toReadingId,
            consumptionPrimary,
            subtotal,
            totalAmount,
            isEstimated,
            hasException,
            exceptionReasons,
          },
        },
      });
    });

    createdCount += 1;
  }

  await prisma.billingCampaign.update({
    where: { id: campaign.id },
    data: {
      status: createdCount > 0 ? BillingCampaignStatus.GENERATED : campaign.status,
      generatedAt: createdCount > 0 ? new Date() : campaign.generatedAt,
      launchedAt:
        campaign.status === BillingCampaignStatus.DRAFT || campaign.status === BillingCampaignStatus.READY
          ? new Date()
          : campaign.launchedAt,
    },
  });

  return {
    status: 200,
    body: {
      message: "campaign_invoices_generated",
      campaignId: campaign.id,
      createdCount,
      skippedCount,
      meterCount: meters.length,
    },
  };
}

export async function issueCampaignInvoices(staff: StaffUser, campaignId: string) {
  const admin = assertAdmin(staff);
  if (!admin.ok) return admin;

  const campaign = await prisma.billingCampaign.findFirst({
    where: { id: campaignId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!campaign) return { status: 404, body: { error: "campaign_not_found" } };

  const issuable = await prisma.invoice.findMany({
    where: {
      campaignId,
      status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.PENDING_REVIEW] },
      deletedAt: null,
    },
    select: { id: true },
  });

  if (issuable.length === 0) {
    return { status: 409, body: { error: "no_issuable_invoices" } };
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.invoice.updateMany({
      where: {
        id: { in: issuable.map((item) => item.id) },
        deletedAt: null,
      },
      data: {
        status: InvoiceStatus.ISSUED,
        issuedAt: now,
        cycleFinalizedAt: now,
        approvedById: staff.id,
      },
    });

    await tx.invoiceEvent.createMany({
      data: issuable.map((invoice) => ({
        invoiceId: invoice.id,
        userId: staff.id,
        type: "ISSUED",
        payload: { campaignId },
      })),
    });

    await tx.billingCampaign.update({
      where: { id: campaignId },
      data: {
        status: BillingCampaignStatus.ISSUED,
        issuedAt: now,
        finalizedAt: now,
      },
    });
  });

  return {
    status: 200,
    body: {
      message: "campaign_invoices_issued",
      issuedCount: issuable.length,
      campaignId,
    },
  };
}

export async function listInvoices(filters: InvoiceFilters) {
  const page = Math.max(1, Number(filters.page || 1));
  const perPage = Math.min(100, Math.max(5, Number(filters.perPage || 20)));
  const search = toTrimmed(filters.search);
  const where: Prisma.InvoiceWhereInput = {
    deletedAt: null,
    ...(filters.status && Object.values(InvoiceStatus).includes(filters.status as InvoiceStatus)
      ? { status: filters.status as InvoiceStatus }
      : {}),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.city || filters.zone
      ? {
          meter: {
            ...(filters.city ? { city: filters.city } : {}),
            ...(filters.zone ? { zone: filters.zone } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { invoiceNumber: { contains: search, mode: "insensitive" } },
            { meter: { serialNumber: { contains: search, mode: "insensitive" } } },
            { customer: { phone: { contains: search, mode: "insensitive" } } },
            { customer: { username: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: {
        campaign: { select: { id: true, code: true, name: true } },
        meter: { select: { id: true, serialNumber: true, city: true, zone: true } },
        customer: {
          select: { id: true, firstName: true, lastName: true, username: true, phone: true },
        },
      },
      orderBy: [{ createdAt: "desc" }],
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
      invoices: rows,
    },
  };
}

export async function getInvoiceDetail(invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    include: {
      campaign: { select: { id: true, code: true, name: true, periodStart: true, periodEnd: true } },
      tariffPlan: { select: { id: true, code: true, name: true } },
      meter: { select: { id: true, serialNumber: true, meterReference: true, city: true, zone: true } },
      customer: {
        select: { id: true, firstName: true, lastName: true, username: true, phone: true, email: true },
      },
      lines: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      events: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 50 },
      payments: { where: { deletedAt: null }, orderBy: { paidAt: "desc" } },
      deliveries: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!invoice) return { status: 404, body: { error: "invoice_not_found" } };
  return { status: 200, body: { invoice } };
}

export async function issueInvoice(staff: StaffUser, invoiceId: string) {
  const admin = assertAdmin(staff);
  if (!admin.ok) return admin;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!invoice) return { status: 404, body: { error: "invoice_not_found" } };
  if (!ISSUABLE_INVOICE_STATUSES.has(invoice.status)) {
    return { status: 409, body: { error: "invoice_not_issuable" } };
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.ISSUED,
        issuedAt: now,
        cycleFinalizedAt: now,
        approvedById: staff.id,
      },
    });
    await tx.invoiceEvent.create({
      data: {
        invoiceId,
        userId: staff.id,
        type: "ISSUED",
        payload: { previousStatus: invoice.status },
      },
    });
    return inv;
  });

  return { status: 200, body: { message: "invoice_issued", invoice: updated } };
}

export async function cancelInvoice(staff: StaffUser, invoiceId: string, reason?: string) {
  const admin = assertAdmin(staff);
  if (!admin.ok) return admin;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!invoice) return { status: 404, body: { error: "invoice_not_found" } };
  if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELED) {
    return { status: 409, body: { error: "invoice_not_cancelable" } };
  }

  const cancelReason = toTrimmed(reason);
  if (!cancelReason) return { status: 400, body: { error: "cancel_reason_required" } };

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.CANCELED,
        canceledAt: now,
        cancelReason,
        canceledById: staff.id,
      },
    });
    await tx.invoiceEvent.create({
      data: {
        invoiceId,
        userId: staff.id,
        type: "CANCELED",
        payload: { reason: cancelReason, previousStatus: invoice.status },
      },
    });
    return inv;
  });

  return { status: 200, body: { message: "invoice_canceled", invoice: updated } };
}

export async function registerInvoicePayment(
  staff: StaffUser,
  invoiceId: string,
  payload: RegisterPaymentPayload
) {
  if (!FINANCE_STAFF_ROLES.has(staff.role)) {
    return { status: 403, body: { error: "insufficient_role" } };
  }

  const amount = Math.max(0, toNumber(payload.amount));
  if (amount <= 0) return { status: 400, body: { error: "amount_must_be_positive" } };

  const method = Object.values(PaymentMethod).includes(payload.method as PaymentMethod)
    ? (payload.method as PaymentMethod)
    : PaymentMethod.CASH;
  const reference = toTrimmed(payload.reference);
  const paidAt = toDate(payload.paidAt) || new Date();

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    select: { id: true, totalAmount: true, paidAmount: true, status: true },
  });
  if (!invoice) return { status: 404, body: { error: "invoice_not_found" } };
  if (invoice.status === InvoiceStatus.CANCELED) {
    return { status: 409, body: { error: "invoice_canceled" } };
  }

  const currentPaid = decimalToNumber(invoice.paidAmount);
  const total = decimalToNumber(invoice.totalAmount);
  const nextPaid = round(currentPaid + amount, TAX_SCALE);
  const nextStatus =
    nextPaid >= total ? InvoiceStatus.PAID : nextPaid > 0 ? InvoiceStatus.PARTIALLY_PAID : invoice.status;

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        invoiceId,
        amount: toDecimal(amount),
        method,
        reference,
        paidAt,
        receivedById: staff.id,
      },
    });

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: toDecimal(nextPaid),
        status: nextStatus,
      },
    });

    await tx.invoiceEvent.create({
      data: {
        invoiceId,
        userId: staff.id,
        type: "PAYMENT_REGISTERED",
        payload: {
          amount,
          method,
          reference,
          nextPaid,
          total,
          nextStatus,
        },
      },
    });

    return { payment, invoice: updated };
  });

  return { status: 201, body: { message: "payment_registered", ...result } };
}

export async function triggerInvoiceDelivery(
  staff: StaffUser,
  invoiceId: string,
  payload: TriggerDeliveryPayload
) {
  if (!FINANCE_STAFF_ROLES.has(staff.role)) {
    return { status: 403, body: { error: "insufficient_role" } };
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    include: {
      customer: { select: { phone: true, email: true, username: true } },
    },
  });
  if (!invoice) return { status: 404, body: { error: "invoice_not_found" } };
  if (!DELIVERABLE_INVOICE_STATUSES.has(invoice.status)) {
    return { status: 409, body: { error: "invoice_not_deliverable" } };
  }

  const channel = Object.values(DeliveryChannel).includes(payload.channel as DeliveryChannel)
    ? (payload.channel as DeliveryChannel)
    : DeliveryChannel.PORTAL;
  const recipient =
    toTrimmed(payload.recipient) ||
    (channel === DeliveryChannel.EMAIL ? invoice.customer.email : invoice.customer.phone) ||
    invoice.customer.username ||
    null;
  if (!recipient) return { status: 400, body: { error: "recipient_required" } };

  const sentAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const delivery = await tx.invoiceDelivery.create({
      data: {
        invoiceId,
        channel,
        recipient,
        status: DeliveryStatus.SENT,
        sentAt,
        triggeredById: staff.id,
        metadata: { mocked: true },
      },
    });

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status:
          invoice.status === InvoiceStatus.ISSUED
            ? InvoiceStatus.DELIVERED
            : invoice.status,
        deliveredAt: sentAt,
      },
    });

    await tx.invoiceEvent.create({
      data: {
        invoiceId,
        userId: staff.id,
        type: "DELIVERY_SENT",
        payload: { channel, recipient },
      },
    });

    return { delivery, invoice: updated };
  });

  return { status: 201, body: { message: "invoice_delivery_recorded", ...result } };
}
