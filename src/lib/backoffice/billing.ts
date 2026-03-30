import {
  BillingCampaignStatus,
  DeliveryChannel,
  DeliveryStatus,
  InvoiceLineType,
  InvoiceStatus,
  PaymentMethod,
  Prisma,
  TariffBillingMode,
  TaxApplicationScope,
  TaxRuleType,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { activeMeterAssignmentCustomerSelect, getActiveMeterAssignment } from "@/lib/meters/assignments";
import {
  buildInvoiceCanceledNotification,
  buildInvoiceDeliveryNotification,
  buildInvoiceIssuedNotification,
  buildInvoicePaymentNotification,
  createCustomerNotification,
  pushCustomerNotification,
} from "@/lib/mobile/customerNotifications";
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

type CreateTaxRuleInput = {
  code?: string;
  name?: string;
  description?: string;
  type?: TaxRuleType;
  applicationScope?: TaxApplicationScope;
  value?: number;
};

type CreateTariffPlanInput = {
  code?: string;
  name?: string;
  description?: string;
  zoneId?: string | null;
  billingMode?: TariffBillingMode;
  currency?: string;
  singleUnitPrice?: number;
  hpUnitPrice?: number;
  hcUnitPrice?: number;
  fixedCharge?: number;
  taxPercent?: number;
  lateFeePercent?: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  isDefault?: boolean;
  tiers?: CreateTariffTierInput[];
  taxes?: CreateTaxRuleInput[];
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
  zoneIds?: string[];
  tariffPlanId?: string;
  notes?: string;
};

type CreateCityInput = {
  code?: string;
  name?: string;
  region?: string;
};

type CreateZoneInput = {
  code?: string;
  name?: string;
  cityId?: string | null;
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

function isDateWithinRange(target: Date, start?: Date | null, end?: Date | null) {
  if (start && target < start) return false;
  if (end && target > end) return false;
  return true;
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

async function resolveZone(inputZoneId?: string | null) {
  if (!inputZoneId) return null;

  const zone = await prisma.zone.findFirst({
    where: { id: inputZoneId, deletedAt: null, isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      cityId: true,
      city: { select: { id: true, code: true, name: true, region: true } },
    },
  });

  return zone ?? null;
}

async function resolveCity(inputCityId?: string | null) {
  if (!inputCityId) return null;

  const city = await prisma.city.findFirst({
    where: { id: inputCityId, deletedAt: null, isActive: true },
    select: { id: true, code: true, name: true, region: true },
  });

  return city ?? null;
}

async function resolveZones(inputZoneIds?: string[]): Promise<
  Array<{
    id: string;
    code: string;
    name: string;
    cityId: string;
    city: {
      id: string;
      code: string;
      name: string;
      region: string | null;
    };
  }>
> {
  const zoneIds = Array.from(
    new Set(
      (inputZoneIds || [])
        .map((zoneId) => toTrimmed(zoneId))
        .filter((zoneId): zoneId is string => Boolean(zoneId))
    )
  );
  if (zoneIds.length === 0) return [];

  return prisma.zone.findMany({
    where: {
      id: { in: zoneIds },
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
      cityId: true,
      city: { select: { id: true, code: true, name: true, region: true } },
    },
    orderBy: [{ city: { name: "asc" } }, { name: "asc" }],
  });
}

function normalizeBillingMode(mode: unknown): TariffBillingMode {
  return mode === TariffBillingMode.TIME_OF_USE
    ? TariffBillingMode.TIME_OF_USE
    : TariffBillingMode.SINGLE_RATE;
}

function normalizeTaxType(type: unknown): TaxRuleType {
  return type === TaxRuleType.FIXED ? TaxRuleType.FIXED : TaxRuleType.PERCENT;
}

function normalizeTaxScope(scope: unknown): TaxApplicationScope {
  if (
    scope === TaxApplicationScope.CONSUMPTION ||
    scope === TaxApplicationScope.FIXED_CHARGE ||
    scope === TaxApplicationScope.SUBTOTAL
  ) {
    return scope;
  }

  return TaxApplicationScope.SUBTOTAL;
}

function normalizeTaxRules(taxes: CreateTaxRuleInput[], fallbackZoneId?: string | null) {
  const seenCodes = new Set<string>();
  const normalized = [];

  for (const tax of taxes) {
    const code = toTrimmed(tax.code)?.toUpperCase();
    const name = toTrimmed(tax.name);
    const description = toTrimmed(tax.description);
    const value = Math.max(0, toNumber(tax.value));

    if (!code || !name) {
      return { ok: false as const, error: "tax_code_and_name_required" };
    }
    if (seenCodes.has(code)) {
      return { ok: false as const, error: "duplicate_tax_code_in_payload" };
    }
    seenCodes.add(code);

    normalized.push({
      code,
      name,
      description,
      type: normalizeTaxType(tax.type),
      applicationScope: normalizeTaxScope(tax.applicationScope),
      value: round(value, M3_SCALE),
      zoneId: fallbackZoneId ?? null,
    });
  }

  return { ok: true as const, taxes: normalized };
}

async function resolveTariffPlanId(inputTariffPlanId?: string | null, zoneIds?: string[]) {
  const resolvedZoneIds = (zoneIds || []).filter(Boolean);
  const singleZoneId = resolvedZoneIds.length === 1 ? resolvedZoneIds[0] : null;

  if (inputTariffPlanId) {
    const plan = await prisma.tariffPlan.findFirst({
      where: {
        id: inputTariffPlanId,
        deletedAt: null,
        isActive: true,
        ...(singleZoneId ? { OR: [{ zoneId: singleZoneId }, { zoneId: null }] } : {}),
      },
      select: { id: true },
    });
    return plan?.id || null;
  }

  const defaultPlan = await prisma.tariffPlan.findFirst({
    where: {
      deletedAt: null,
      isDefault: true,
      isActive: true,
      ...(singleZoneId ? { OR: [{ zoneId: singleZoneId }, { zoneId: null }] } : { zoneId: null }),
    },
    orderBy: [{ zoneId: "desc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (defaultPlan) return defaultPlan.id;

  const anyPlan = await prisma.tariffPlan.findFirst({
    where: {
      deletedAt: null,
      isActive: true,
      ...(singleZoneId ? { OR: [{ zoneId: singleZoneId }, { zoneId: null }] } : { zoneId: null }),
    },
    orderBy: [{ zoneId: "desc" }, { createdAt: "asc" }],
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

function buildRateLabel(mode: TariffBillingMode, channel: "PRIMARY" | "SECONDARY" | "TOTAL") {
  if (mode === TariffBillingMode.TIME_OF_USE) {
    return channel === "PRIMARY" ? "Energie HP" : "Energie HC";
  }

  return "Energie facturee";
}

function computeTariffCharge(
  tariffPlan: {
    billingMode: TariffBillingMode;
    singleUnitPrice: Prisma.Decimal | null;
    hpUnitPrice: Prisma.Decimal | null;
    hcUnitPrice: Prisma.Decimal | null;
  },
  consumptionPrimary: number,
  consumptionSecondary: number,
) {
  if (tariffPlan.billingMode === TariffBillingMode.TIME_OF_USE) {
    const hpUnitPrice = decimalToNumber(tariffPlan.hpUnitPrice);
    const hcUnitPrice = decimalToNumber(tariffPlan.hcUnitPrice);
    const hpAmount = round(consumptionPrimary * hpUnitPrice, TAX_SCALE);
    const hcAmount = round(consumptionSecondary * hcUnitPrice, TAX_SCALE);

    const lines = [
      {
        label: buildRateLabel(tariffPlan.billingMode, "PRIMARY"),
        quantity: round(consumptionPrimary, M3_SCALE),
        unitPrice: round(hpUnitPrice, M3_SCALE),
        amount: hpAmount,
        meta: { indexType: "PRIMARY" },
      },
      {
        label: buildRateLabel(tariffPlan.billingMode, "SECONDARY"),
        quantity: round(consumptionSecondary, M3_SCALE),
        unitPrice: round(hcUnitPrice, M3_SCALE),
        amount: hcAmount,
        meta: { indexType: "SECONDARY" },
      },
    ].filter((line) => line.quantity > 0 || line.amount > 0);

    return { lines, total: round(hpAmount + hcAmount, TAX_SCALE) };
  }

  const singleUnitPrice = decimalToNumber(tariffPlan.singleUnitPrice);
  const totalConsumption = round(consumptionPrimary + consumptionSecondary, M3_SCALE);
  const amount = round(totalConsumption * singleUnitPrice, TAX_SCALE);

  return {
    lines: [
      {
        label: buildRateLabel(tariffPlan.billingMode, "TOTAL"),
        quantity: totalConsumption,
        unitPrice: round(singleUnitPrice, M3_SCALE),
        amount,
        meta: {
          billedSecondaryIncluded: consumptionSecondary > 0,
        },
      },
    ].filter((line) => line.quantity > 0 || line.amount > 0),
    total: amount,
  };
}

function computeAdditionalTaxes(
  taxLinks: Array<{
    sortOrder: number;
    taxRule: {
      code: string;
      name: string;
      type: TaxRuleType;
      applicationScope: TaxApplicationScope;
      value: Prisma.Decimal;
    };
  }>,
  amounts: { consumption: number; fixedCharge: number; subtotal: number },
) {
  const lines = [];
  let total = 0;

  const orderedTaxLinks = [...taxLinks].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const link of orderedTaxLinks) {
    const rule = link.taxRule;
    const value = decimalToNumber(rule.value);
    const baseAmount =
      rule.applicationScope === TaxApplicationScope.CONSUMPTION
        ? amounts.consumption
        : rule.applicationScope === TaxApplicationScope.FIXED_CHARGE
          ? amounts.fixedCharge
          : amounts.subtotal;

    const amount =
      rule.type === TaxRuleType.PERCENT
        ? round((baseAmount * value) / 100, TAX_SCALE)
        : round(value, TAX_SCALE);

    lines.push({
      label: rule.type === TaxRuleType.PERCENT ? `${rule.name} (${value}%)` : rule.name,
      quantity: 1,
      unitPrice: amount,
      amount,
      meta: {
        taxRuleCode: rule.code,
        taxType: rule.type,
        applicationScope: rule.applicationScope,
        baseAmount,
        value,
      },
    });
    total += amount;
  }

  return { lines, total: round(total, TAX_SCALE) };
}

export async function listZones() {
  const zones = await prisma.zone.findMany({
    where: { deletedAt: null },
    orderBy: [{ city: { name: "asc" } }, { name: "asc" }],
    include: {
      city: true,
      _count: {
        select: { meters: true, tariffPlans: true, campaignAssignments: true },
      },
    },
  });

  return { status: 200, body: { zones } };
}

export async function listCities() {
  const cities = await prisma.city.findMany({
    where: { deletedAt: null },
    orderBy: [{ name: "asc" }],
    include: {
      _count: {
        select: { zones: true },
      },
    },
  });

  return { status: 200, body: { cities } };
}

export async function createCity(staff: StaffUser, payload: CreateCityInput) {
  const code = toTrimmed(payload.code)?.toUpperCase();
  const name = toTrimmed(payload.name);
  const region = toTrimmed(payload.region);

  if (!code || !name) {
    return { status: 400, body: { error: "city_code_name_required" } };
  }

  try {
    const city = await prisma.city.create({
      data: {
        code,
        name,
        region,
      },
    });

    return { status: 201, body: { message: "city_created", city } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: 409, body: { error: "city_code_already_exists" } };
    }
    return { status: 500, body: { error: "failed_to_create_city" } };
  }
}

export async function createZone(staff: StaffUser, payload: CreateZoneInput) {
  const code = toTrimmed(payload.code)?.toUpperCase();
  const name = toTrimmed(payload.name);
  const cityId = toTrimmed(payload.cityId);

  if (!code || !name || !cityId) {
    return { status: 400, body: { error: "zone_code_name_city_required" } };
  }

  const city = await resolveCity(cityId);
  if (!city) {
    return { status: 400, body: { error: "city_not_found" } };
  }

  try {
    const zone = await prisma.zone.create({
      data: {
        code,
        name,
        cityId: city.id,
      },
      include: {
        city: { select: { id: true, code: true, name: true, region: true } },
      },
    });

    return { status: 201, body: { message: "zone_created", zone } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: 409, body: { error: "zone_code_already_exists" } };
    }
    return { status: 500, body: { error: "failed_to_create_zone" } };
  }
}

export async function listTariffPlans() {
  const plans = await prisma.tariffPlan.findMany({
    where: { deletedAt: null },
    include: {
      tiers: {
        where: { deletedAt: null },
        orderBy: { minConsumption: "asc" },
      },
      serviceZone: {
        select: {
          id: true,
          code: true,
          name: true,
          city: { select: { id: true, code: true, name: true, region: true } },
        },
      },
      taxes: {
        where: { deletedAt: null, taxRule: { deletedAt: null } },
        orderBy: { sortOrder: "asc" },
        include: {
          taxRule: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              applicationScope: true,
              value: true,
            },
          },
        },
      },
      _count: { select: { invoices: true, campaigns: true } },
    },
    orderBy: [{ isDefault: "desc" }, { code: "asc" }, { createdAt: "asc" }],
  });

  return { status: 200, body: { plans } };
}

export async function createTariffPlan(staff: StaffUser, payload: CreateTariffPlanInput) {
  const code = toTrimmed(payload.code)?.toUpperCase();
  const name = toTrimmed(payload.name);
  const description = toTrimmed(payload.description);
  const zoneId = toTrimmed(payload.zoneId);
  const billingMode = normalizeBillingMode(payload.billingMode);
  const currency = toTrimmed(payload.currency)?.toUpperCase() || "XAF";
  const singleUnitPrice = Math.max(0, toNumber(payload.singleUnitPrice));
  const hpUnitPrice = Math.max(0, toNumber(payload.hpUnitPrice));
  const hcUnitPrice = Math.max(0, toNumber(payload.hcUnitPrice));
  const fixedCharge = Math.max(0, toNumber(payload.fixedCharge));
  const taxPercent = Math.max(0, toNumber(payload.taxPercent));
  const lateFeePercent = Math.max(0, toNumber(payload.lateFeePercent));
  const effectiveFrom = toDate(payload.effectiveFrom);
  const effectiveTo = toDate(payload.effectiveTo);
  const isDefault = Boolean(payload.isDefault);
  const taxesInput = Array.isArray(payload.taxes) ? payload.taxes : [];

  if (!code || !name) {
    return { status: 400, body: { error: "code_and_name_required" } };
  }
  if (effectiveFrom && effectiveTo && effectiveTo <= effectiveFrom) {
    return { status: 400, body: { error: "invalid_effective_range" } };
  }
  if (
    (billingMode === TariffBillingMode.SINGLE_RATE && singleUnitPrice <= 0) ||
    (billingMode === TariffBillingMode.TIME_OF_USE && (hpUnitPrice <= 0 || hcUnitPrice <= 0))
  ) {
    return {
      status: 400,
      body: {
        error:
          billingMode === TariffBillingMode.SINGLE_RATE
            ? "single_unit_price_required"
            : "hp_hc_unit_prices_required",
      },
    };
  }

  const zone = zoneId ? await resolveZone(zoneId) : null;
  if (zoneId && !zone) {
    return { status: 400, body: { error: "zone_not_found" } };
  }

  const normalizedTaxes = normalizeTaxRules(taxesInput, zone?.id ?? null);
  if (!normalizedTaxes.ok) {
    return { status: 400, body: { error: normalizedTaxes.error } };
  }

  if (normalizedTaxes.taxes.length > 0) {
    const existingTaxCodes = await prisma.taxRule.findMany({
      where: {
        code: { in: normalizedTaxes.taxes.map((tax) => tax.code) },
        deletedAt: null,
      },
      select: { code: true },
    });
    if (existingTaxCodes.length > 0) {
      return { status: 409, body: { error: "tax_code_already_exists" } };
    }
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
          zoneId: zone?.id ?? null,
          billingMode,
          currency,
          singleUnitPrice:
            billingMode === TariffBillingMode.SINGLE_RATE ? toDecimal(singleUnitPrice, M3_SCALE) : null,
          hpUnitPrice:
            billingMode === TariffBillingMode.TIME_OF_USE ? toDecimal(hpUnitPrice, M3_SCALE) : null,
          hcUnitPrice:
            billingMode === TariffBillingMode.TIME_OF_USE ? toDecimal(hcUnitPrice, M3_SCALE) : null,
          fixedCharge: toDecimal(fixedCharge),
          taxPercent: toDecimal(taxPercent),
          lateFeePercent: toDecimal(lateFeePercent),
          effectiveFrom,
          effectiveTo,
          isDefault,
          taxes: {
            create: normalizedTaxes.taxes.map((tax, index) => ({
              sortOrder: index,
              taxRule: {
                create: {
                  code: tax.code,
                  name: tax.name,
                  description: tax.description,
                  zoneId: tax.zoneId,
                  type: tax.type,
                  applicationScope: tax.applicationScope,
                  value: toDecimal(tax.value, M3_SCALE),
                  isActive: true,
                  effectiveFrom,
                  effectiveTo,
                },
              },
            })),
          },
        },
        include: {
          tiers: { where: { deletedAt: null }, orderBy: { minConsumption: "asc" } },
          serviceZone: {
            select: {
              id: true,
              code: true,
              name: true,
              city: { select: { id: true, code: true, name: true, region: true } },
            },
          },
          taxes: {
            where: { deletedAt: null, taxRule: { deletedAt: null } },
            orderBy: { sortOrder: "asc" },
            include: {
              taxRule: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  type: true,
                  applicationScope: true,
                  value: true,
                },
              },
            },
          },
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
  const existing = await prisma.tariffPlan.findFirst({
    where: { id: tariffPlanId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return { status: 404, body: { error: "tariff_plan_not_found" } };
  const billingMode =
    payload.billingMode !== undefined ? normalizeBillingMode(payload.billingMode) : undefined;

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
        zoneId: payload.zoneId !== undefined ? toTrimmed(payload.zoneId) : undefined,
        billingMode,
        currency: toTrimmed(payload.currency)?.toUpperCase() || undefined,
        singleUnitPrice:
          payload.singleUnitPrice !== undefined
            ? toDecimal(Math.max(0, toNumber(payload.singleUnitPrice)), M3_SCALE)
            : undefined,
        hpUnitPrice:
          payload.hpUnitPrice !== undefined
            ? toDecimal(Math.max(0, toNumber(payload.hpUnitPrice)), M3_SCALE)
            : undefined,
        hcUnitPrice:
          payload.hcUnitPrice !== undefined
            ? toDecimal(Math.max(0, toNumber(payload.hcUnitPrice)), M3_SCALE)
            : undefined,
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
        effectiveFrom:
          payload.effectiveFrom !== undefined ? toDate(payload.effectiveFrom) : undefined,
        effectiveTo: payload.effectiveTo !== undefined ? toDate(payload.effectiveTo) : undefined,
        isDefault: payload.isDefault,
        isActive: payload.isActive,
      },
      include: {
        tiers: { where: { deletedAt: null }, orderBy: { minConsumption: "asc" } },
        serviceZone: {
          select: {
            id: true,
            code: true,
            name: true,
            city: { select: { id: true, code: true, name: true, region: true } },
          },
        },
        taxes: {
          where: { deletedAt: null, taxRule: { deletedAt: null } },
          orderBy: { sortOrder: "asc" },
          include: {
            taxRule: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
                applicationScope: true,
                value: true,
              },
            },
          },
        },
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
      cityNameSnapshot: true,
      zoneNameSnapshot: true,
      status: true,
      zones: {
        where: { deletedAt: null, zone: { deletedAt: null } },
        orderBy: [{ zone: { city: { name: "asc" } } }, { zone: { name: "asc" } }],
        select: {
          id: true,
          cityNameSnapshot: true,
          zoneNameSnapshot: true,
          zone: {
            select: {
              id: true,
              code: true,
              name: true,
              city: { select: { id: true, code: true, name: true, region: true } },
            },
          },
        },
      },
      tariffPlan: { select: { id: true, code: true, name: true } },
      _count: { select: { invoices: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });
  return { status: 200, body: { campaigns } };
}

export async function createBillingCampaign(staff: StaffUser, payload: CreateCampaignInput) {
  const code = toTrimmed(payload.code)?.toUpperCase();
  const name = toTrimmed(payload.name);
  const periodStart = toDate(payload.periodStart);
  const periodEnd = toDate(payload.periodEnd);
  const submissionStartAt = toDate(payload.submissionStartAt);
  const submissionEndAt = toDate(payload.submissionEndAt);
  const cutoffAt = toDate(payload.cutoffAt);
  const frequency = toTrimmed(payload.frequency) || "MONTHLY";
  const requestedZoneIds = Array.isArray(payload.zoneIds) ? payload.zoneIds : [];
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

  const selectedZones = await resolveZones(requestedZoneIds);
  if (requestedZoneIds.length > 0 && selectedZones.length !== new Set(requestedZoneIds).size) {
    return { status: 400, body: { error: "one_or_more_zones_not_found" } };
  }

  const selectedZoneIds = selectedZones.map((zone) => zone.id);
  const tariffPlanId = await resolveTariffPlanId(toTrimmed(payload.tariffPlanId), selectedZoneIds);
  if (!tariffPlanId) {
    return { status: 400, body: { error: "active_tariff_plan_required" } };
  }

  const settings = await getAppSettings();

  const selectedTariff = await prisma.tariffPlan.findFirst({
    where: { id: tariffPlanId, deletedAt: null, isActive: true },
    select: { zoneId: true, code: true },
  });
  if (!selectedTariff) {
    return { status: 400, body: { error: "active_tariff_plan_required" } };
  }
  if (selectedTariff.zoneId) {
    if (selectedZoneIds.length !== 1) {
      return { status: 400, body: { error: "tariff_requires_single_matching_zone" } };
    }
    if (selectedTariff.zoneId !== selectedZoneIds[0]) {
      return { status: 400, body: { error: "tariff_zone_mismatch" } };
    }
  }
  if (!selectedTariff.zoneId && selectedZoneIds.length === 0) {
    // Global campaigns remain allowed. No extra validation needed.
  } else if (selectedZoneIds.length > 0 && selectedTariff.zoneId && selectedTariff.zoneId !== selectedZoneIds[0]) {
    return { status: 400, body: { error: "tariff_zone_mismatch" } };
  }

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
        cityNameSnapshot:
          selectedZones.length === 1
            ? selectedZones[0].city.name
            : selectedZones.length > 1
              ? "MULTI_ZONE"
              : null,
        zoneNameSnapshot:
          selectedZones.length === 1
            ? selectedZones[0].name
            : selectedZones.length > 1
              ? `${selectedZones.length} zones`
              : null,
        notes,
        tariffPlanId,
        createdById: staff.id,
        settingsSnapshot: settings,
        zones: {
          create: selectedZones.map((selectedZone) => ({
            zoneId: selectedZone.id,
            cityNameSnapshot: selectedZone.city.name,
            zoneNameSnapshot: selectedZone.name,
          })),
        },
      },
      include: {
        zones: {
          where: { deletedAt: null, zone: { deletedAt: null } },
          include: {
            zone: {
              select: {
                id: true,
                code: true,
                name: true,
                city: { select: { id: true, code: true, name: true, region: true } },
              },
            },
          },
        },
        tariffPlan: { select: { id: true, code: true, name: true } },
      },
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
  const campaign = await prisma.billingCampaign.findFirst({
    where: { id: campaignId, deletedAt: null },
    include: {
      zones: {
        where: { deletedAt: null, zone: { deletedAt: null } },
        include: {
          zone: {
            select: {
              id: true,
              code: true,
              name: true,
              city: { select: { id: true, code: true, name: true, region: true } },
            },
          },
        },
      },
      tariffPlan: {
        include: {
          taxes: {
            where: { deletedAt: null, taxRule: { deletedAt: null, isActive: true } },
            orderBy: { sortOrder: "asc" },
            include: {
              taxRule: true,
            },
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
  if (!isDateWithinRange(campaign.periodEnd, tariffPlan.effectiveFrom, tariffPlan.effectiveTo)) {
    return { status: 400, body: { error: "tariff_plan_not_effective_for_campaign" } };
  }
  if (campaign.finalizedAt) {
    return { status: 409, body: { error: "campaign_cycle_finalized" } };
  }
  if (campaign.status === BillingCampaignStatus.ISSUED || campaign.status === BillingCampaignStatus.CLOSED) {
    return { status: 409, body: { error: "campaign_not_generatable" } };
  }

  const submissionStart = campaign.submissionStartAt ?? campaign.periodStart;
  const submissionEnd = campaign.submissionEndAt ?? campaign.periodEnd;
  const cutoffAt = campaign.cutoffAt ?? campaign.periodEnd;
  const campaignZoneIds = campaign.zones.map((link) => link.zoneId);
  const campaignZones = campaign.zones.map((link) => link.zone);
  const effectiveTaxLinks = tariffPlan.taxes.filter((link) =>
    isDateWithinRange(campaign.periodEnd, link.taxRule.effectiveFrom, link.taxRule.effectiveTo)
  );

  const meters = await prisma.meter.findMany({
    where: {
      deletedAt: null,
      status: { in: ["ACTIVE", "REPLACED"] },
      ...(campaignZoneIds.length > 0 ? { zoneId: { in: campaignZoneIds } } : {}),
    },
    select: {
      id: true,
      serialNumber: true,
      status: true,
      type: true,
      zoneId: true,
      ...activeMeterAssignmentCustomerSelect,
    },
  });

  let createdCount = 0;
  let skippedCount = 0;

  for (const meter of meters) {
    const activeAssignment = getActiveMeterAssignment(meter);
    if (!activeAssignment) {
      skippedCount += 1;
      continue;
    }

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

    if (meter.type === "DUAL_INDEX" && fromSecondary === null && toSecondary !== null) {
      hasException = true;
      exceptionReasons.push("missing_secondary_baseline_reference");
    }

    if (meter.status === "REPLACED") {
      hasException = true;
      exceptionReasons.push("meter_replaced_cycle_break");
    }

    const decreasingIndex = fromPrimary !== null && toPrimary !== null && toPrimary < fromPrimary;
    const decreasingSecondaryIndex =
      fromSecondary !== null && toSecondary !== null && toSecondary < fromSecondary;
    if (decreasingIndex) {
      hasException = true;
      exceptionReasons.push("decreasing_index_detected");
    }
    if (decreasingSecondaryIndex) {
      hasException = true;
      exceptionReasons.push("decreasing_secondary_index_detected");
    }

    const safeFromPrimary = fromPrimary === null ? toPrimary ?? 0 : fromPrimary;
    const safeToPrimary = toPrimary === null ? safeFromPrimary : toPrimary;
    const safeFromSecondary = fromSecondary === null ? toSecondary ?? 0 : fromSecondary;
    const safeToSecondary = toSecondary === null ? safeFromSecondary : toSecondary;
    const consumptionPrimary =
      decreasingIndex ? 0 : Math.max(0, round(safeToPrimary - safeFromPrimary, M3_SCALE));
    const consumptionSecondary =
      decreasingSecondaryIndex
        ? 0
        : Math.max(0, round(safeToSecondary - safeFromSecondary, M3_SCALE));

    const charge = computeTariffCharge(
      tariffPlan,
      consumptionPrimary,
      meter.type === "DUAL_INDEX" ? consumptionSecondary : 0,
    );
    const fixedAmount = decimalToNumber(tariffPlan.fixedCharge);
    const subtotal = round(charge.total, TAX_SCALE);
    const subtotalBase = round(subtotal + fixedAmount, TAX_SCALE);
    const taxRate = decimalToNumber(tariffPlan.taxPercent);
    const baseTaxAmount = round((subtotalBase * taxRate) / 100, TAX_SCALE);
    const additionalTaxes = computeAdditionalTaxes(effectiveTaxLinks, {
      consumption: subtotal,
      fixedCharge: fixedAmount,
      subtotal: subtotalBase,
    });
    const taxAmount = round(baseTaxAmount + additionalTaxes.total, TAX_SCALE);
    const totalAmount = round(subtotalBase + taxAmount, TAX_SCALE);

    const invoiceNumber = await generateInvoiceNumber(reading?.readingAt ?? cutoffAt);

    await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          campaignId: campaign.id,
          tariffPlanId: campaign.tariffPlanId,
          customerId: activeAssignment.customerId,
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
          fromSecondaryIndex: fromSecondary !== null ? toDecimal(safeFromSecondary, M3_SCALE) : null,
          toSecondaryIndex: toSecondary !== null ? toDecimal(safeToSecondary, M3_SCALE) : null,
          previousPrimary: toDecimal(safeFromPrimary, M3_SCALE),
          currentPrimary: toDecimal(safeToPrimary, M3_SCALE),
          previousSecondary: fromSecondary !== null ? toDecimal(safeFromSecondary, M3_SCALE) : null,
          currentSecondary: toSecondary !== null ? toDecimal(safeToSecondary, M3_SCALE) : null,
          consumptionPrimary: toDecimal(consumptionPrimary, M3_SCALE),
          consumptionSecondary:
            meter.type === "DUAL_INDEX" ? toDecimal(consumptionSecondary, M3_SCALE) : null,
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
            billingMode: tariffPlan.billingMode,
            taxRate,
            cycle: {
              fromReadingId,
              toReadingId,
              cutoffAt,
              submissionStart,
              submissionEnd,
            },
            appliedTaxes: effectiveTaxLinks.map((link) => ({
              code: link.taxRule.code,
              name: link.taxRule.name,
              type: link.taxRule.type,
              applicationScope: link.taxRule.applicationScope,
              value: decimalToNumber(link.taxRule.value),
            })),
            serviceZones:
              campaignZones.length > 0
                ? campaignZones.map((zone) => ({
                    id: zone.id,
                    code: zone.code,
                    name: zone.name,
                    city: zone.city.name,
                  }))
                : null,
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
          meta: line.meta,
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
          unitPrice: toDecimal(baseTaxAmount, M3_SCALE),
          amount: toDecimal(baseTaxAmount),
          meta: {
            taxPercent: taxRate,
            taxKind: "BASE",
          },
        },
        ...additionalTaxes.lines.map((taxLine) => ({
          invoiceId: created.id,
          type: InvoiceLineType.TAX,
          label: taxLine.label,
          quantity: toDecimal(taxLine.quantity, M3_SCALE),
          unitPrice: toDecimal(taxLine.unitPrice, M3_SCALE),
          amount: toDecimal(taxLine.amount),
          meta: taxLine.meta,
        })),
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
            consumptionSecondary,
            subtotal,
            totalAmount,
            isEstimated,
            hasException,
            billingMode: tariffPlan.billingMode,
            appliedTaxCodes: effectiveTaxLinks.map((link) => link.taxRule.code),
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
    select: {
      id: true,
      customerId: true,
      invoiceNumber: true,
      meterId: true,
      dueDate: true,
      totalAmount: true,
      meter: {
        select: {
          serialNumber: true,
        },
      },
    },
  });

  if (issuable.length === 0) {
    return { status: 409, body: { error: "no_issuable_invoices" } };
  }

  const now = new Date();
  const createdNotifications = await prisma.$transaction(async (tx) => {
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

    const notifications: Awaited<ReturnType<typeof createCustomerNotification>>[] = [];
    for (const invoice of issuable) {
      notifications.push(
        await createCustomerNotification(
          tx,
          buildInvoiceIssuedNotification({
            userId: invoice.customerId,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            meterId: invoice.meterId,
            meterSerialNumber: invoice.meter.serialNumber,
            totalAmount: decimalToNumber(invoice.totalAmount),
            dueDate: invoice.dueDate,
            createdAt: now,
          })
        )
      );
    }

    await tx.billingCampaign.update({
      where: { id: campaignId },
      data: {
        status: BillingCampaignStatus.ISSUED,
        issuedAt: now,
        finalizedAt: now,
      },
    });

    return notifications;
  });

  await Promise.all(createdNotifications.map((notification) => pushCustomerNotification(notification)));

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
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    select: {
      id: true,
      status: true,
      customerId: true,
      invoiceNumber: true,
      meterId: true,
      dueDate: true,
      totalAmount: true,
      meter: { select: { serialNumber: true } },
    },
  });
  if (!invoice) return { status: 404, body: { error: "invoice_not_found" } };
  if (!ISSUABLE_INVOICE_STATUSES.has(invoice.status)) {
    return { status: 409, body: { error: "invoice_not_issuable" } };
  }

  const now = new Date();
  const { invoice: updated, notification } = await prisma.$transaction(async (tx) => {
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

    const createdNotification = await createCustomerNotification(
      tx,
      buildInvoiceIssuedNotification({
        userId: invoice.customerId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        meterId: invoice.meterId,
        meterSerialNumber: invoice.meter.serialNumber,
        totalAmount: decimalToNumber(invoice.totalAmount),
        dueDate: invoice.dueDate,
        createdAt: now,
      })
    );

    return { invoice: inv, notification: createdNotification };
  });

  await pushCustomerNotification(notification);

  return { status: 200, body: { message: "invoice_issued", invoice: updated } };
}

export async function cancelInvoice(staff: StaffUser, invoiceId: string, reason?: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    select: {
      id: true,
      status: true,
      customerId: true,
      invoiceNumber: true,
      meterId: true,
      meter: { select: { serialNumber: true } },
    },
  });
  if (!invoice) return { status: 404, body: { error: "invoice_not_found" } };
  if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELED) {
    return { status: 409, body: { error: "invoice_not_cancelable" } };
  }

  const cancelReason = toTrimmed(reason);
  if (!cancelReason) return { status: 400, body: { error: "cancel_reason_required" } };

  const now = new Date();
  const { invoice: updated, notification } = await prisma.$transaction(async (tx) => {
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

    const createdNotification = await createCustomerNotification(
      tx,
      buildInvoiceCanceledNotification({
        userId: invoice.customerId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        meterId: invoice.meterId,
        meterSerialNumber: invoice.meter.serialNumber,
        cancelReason,
        createdAt: now,
      })
    );

    return { invoice: inv, notification: createdNotification };
  });

  await pushCustomerNotification(notification);

  return { status: 200, body: { message: "invoice_canceled", invoice: updated } };
}

export async function registerInvoicePayment(
  staff: StaffUser,
  invoiceId: string,
  payload: RegisterPaymentPayload
) {
  const amount = Math.max(0, toNumber(payload.amount));
  if (amount <= 0) return { status: 400, body: { error: "amount_must_be_positive" } };

  const method = Object.values(PaymentMethod).includes(payload.method as PaymentMethod)
    ? (payload.method as PaymentMethod)
    : PaymentMethod.CASH;
  const reference = toTrimmed(payload.reference);
  const paidAt = toDate(payload.paidAt) || new Date();

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    select: {
      id: true,
      totalAmount: true,
      paidAmount: true,
      status: true,
      customerId: true,
      invoiceNumber: true,
      meterId: true,
      meter: { select: { serialNumber: true } },
    },
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

    const notification = await createCustomerNotification(
      tx,
      buildInvoicePaymentNotification({
        userId: invoice.customerId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        meterId: invoice.meterId,
        meterSerialNumber: invoice.meter.serialNumber,
        amount,
        totalAmount: total,
        paidAmount: nextPaid,
        paymentMethod: method,
        nextStatus,
        createdAt: paidAt,
      })
    );

    return { payment, invoice: updated, notification };
  });

  await pushCustomerNotification(result.notification);
  const { notification: _notification, ...response } = result;

  return { status: 201, body: { message: "payment_registered", ...response } };
}

export async function triggerInvoiceDelivery(
  staff: StaffUser,
  invoiceId: string,
  payload: TriggerDeliveryPayload
) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    include: {
      customer: { select: { phone: true, email: true, username: true } },
      meter: { select: { id: true, serialNumber: true } },
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

    const notification = await createCustomerNotification(
      tx,
      buildInvoiceDeliveryNotification({
        userId: invoice.customerId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        meterId: invoice.meter.id,
        meterSerialNumber: invoice.meter.serialNumber,
        channel,
        nextStatus:
          invoice.status === InvoiceStatus.ISSUED ? InvoiceStatus.DELIVERED : invoice.status,
        createdAt: sentAt,
      })
    );

    return { delivery, invoice: updated, notification };
  });

  await pushCustomerNotification(result.notification);
  const { notification: _notification, ...response } = result;

  return { status: 201, body: { message: "invoice_delivery_recorded", ...response } };
}
