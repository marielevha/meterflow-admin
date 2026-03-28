import { MeterType } from "@prisma/client";

type AdminTranslate = (key: string, values?: Record<string, string | number>) => string;

type StringLike = { toString(): string } | string | null | undefined;

function toDisplayValue(value: StringLike, fallback: string) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  return value.toString();
}

export function getAdminMeterIndexLabels(
  meterType: MeterType | null | undefined,
  t: AdminTranslate
) {
  const isDual = meterType === MeterType.DUAL_INDEX;

  return {
    isDual,
    primaryIndex: isDual ? t("common.hpIndex") : t("common.index"),
    secondaryIndex: t("common.hcIndex"),
    primaryShort: isDual ? t("common.hpShort") : t("common.index"),
    secondaryShort: t("common.hcShort"),
    fieldPrimaryIndex: isDual ? t("tasks.fieldHpIndex") : t("tasks.fieldIndex"),
    fieldSecondaryIndex: t("tasks.fieldHcIndex"),
    referencePrimaryIndex: isDual ? t("readings.referenceHpIndex") : t("readings.referenceIndex"),
    referenceSecondaryIndex: t("readings.referenceHcIndex"),
    checkPrimaryIndexMonotonic: isDual
      ? t("readings.checkHpIndexMonotonic")
      : t("readings.checkIndexMonotonic"),
    checkSecondaryIndexMonotonic: t("readings.checkHcIndexMonotonic"),
    invalidPrimaryIndex: isDual ? t("readings.errorInvalidHpIndex") : t("readings.errorInvalidIndex"),
    invalidSecondaryIndex: t("readings.errorInvalidHcIndex"),
  };
}

export function formatAdminMeterIndexSummary(params: {
  meterType: MeterType | null | undefined;
  primary: StringLike;
  secondary?: StringLike;
  t: AdminTranslate;
  fallback?: string;
  status?: string | null;
}) {
  const fallback = params.fallback ?? params.t("common.notAvailable");
  const labels = getAdminMeterIndexLabels(params.meterType, params.t);
  const primary = toDisplayValue(params.primary, fallback);
  const secondary = toDisplayValue(params.secondary, fallback);

  if (labels.isDual || params.secondary !== null && params.secondary !== undefined) {
    const summary = `${labels.primaryShort}: ${primary} | ${labels.secondaryShort}: ${secondary}`;
    return params.status ? `${params.status} - ${summary}` : summary;
  }

  return params.status ? `${params.status} - ${primary}` : primary;
}
