export const APP_SETTINGS_DB_KEY = "global";

export type AppSettings = {
  companyName: string;
  defaultCountryCode: string;
  timezone: string;
  locale: string;
  requireGpsForReading: boolean;
  maxGpsDistanceMeters: number;
  allowClientResubmission: boolean;
  reviewSlaHours: number;
  enableAnomalyScoring: boolean;
  anomalyThreshold: number;
  strictMonotonicIndex: boolean;
  requirePhotoHash: boolean;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  dailyDigestHour: number;
  maxImageSizeMb: number;
  retentionDays: number;
  allowedMimeTypes: string;
  accessTokenTtlMinutes: number;
  refreshTokenTtlDays: number;
  otpTtlMinutes: number;
  maxLoginAttempts: number;
  showOverviewValidationRate: boolean;
  showOverviewActivityTrend: boolean;
  showOverviewStatusMix: boolean;
  showOverviewTasksByStatus: boolean;
  showOverviewTopAgents: boolean;
  showOverviewRiskiestZones: boolean;
  showOverviewUserDistribution: boolean;
  showOverviewOpsDelay: boolean;
  showOverviewOpsBacklog: boolean;
  showOverviewOpsAnomaly: boolean;
  showOverviewOpsVolume: boolean;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  companyName: "MeterFlow",
  defaultCountryCode: "CG",
  timezone: "Africa/Brazzaville",
  locale: "fr-FR",
  requireGpsForReading: true,
  maxGpsDistanceMeters: 200,
  allowClientResubmission: true,
  reviewSlaHours: 24,
  enableAnomalyScoring: true,
  anomalyThreshold: 65,
  strictMonotonicIndex: true,
  requirePhotoHash: true,
  emailNotificationsEnabled: true,
  smsNotificationsEnabled: false,
  pushNotificationsEnabled: true,
  dailyDigestHour: 8,
  maxImageSizeMb: 8,
  retentionDays: 365,
  allowedMimeTypes: "image/jpeg,image/png,image/webp",
  accessTokenTtlMinutes: 30,
  refreshTokenTtlDays: 14,
  otpTtlMinutes: 10,
  maxLoginAttempts: 5,
  showOverviewValidationRate: true,
  showOverviewActivityTrend: true,
  showOverviewStatusMix: true,
  showOverviewTasksByStatus: true,
  showOverviewTopAgents: true,
  showOverviewRiskiestZones: true,
  showOverviewUserDistribution: true,
  showOverviewOpsDelay: true,
  showOverviewOpsBacklog: true,
  showOverviewOpsAnomaly: true,
  showOverviewOpsVolume: true,
};

type RecordLike = Record<string, unknown>;

function asRecord(value: unknown): RecordLike | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as RecordLike;
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function normalizeAppSettings(input: unknown): AppSettings {
  const candidate = asRecord(input);
  if (!candidate) return { ...DEFAULT_APP_SETTINGS };

  return {
    companyName: asString(candidate.companyName, DEFAULT_APP_SETTINGS.companyName),
    defaultCountryCode: asString(
      candidate.defaultCountryCode,
      DEFAULT_APP_SETTINGS.defaultCountryCode,
    ),
    timezone: asString(candidate.timezone, DEFAULT_APP_SETTINGS.timezone),
    locale: asString(candidate.locale, DEFAULT_APP_SETTINGS.locale),
    requireGpsForReading: asBoolean(
      candidate.requireGpsForReading,
      DEFAULT_APP_SETTINGS.requireGpsForReading,
    ),
    maxGpsDistanceMeters: asNumber(
      candidate.maxGpsDistanceMeters,
      DEFAULT_APP_SETTINGS.maxGpsDistanceMeters,
    ),
    allowClientResubmission: asBoolean(
      candidate.allowClientResubmission,
      DEFAULT_APP_SETTINGS.allowClientResubmission,
    ),
    reviewSlaHours: asNumber(candidate.reviewSlaHours, DEFAULT_APP_SETTINGS.reviewSlaHours),
    enableAnomalyScoring: asBoolean(
      candidate.enableAnomalyScoring,
      DEFAULT_APP_SETTINGS.enableAnomalyScoring,
    ),
    anomalyThreshold: asNumber(candidate.anomalyThreshold, DEFAULT_APP_SETTINGS.anomalyThreshold),
    strictMonotonicIndex: asBoolean(
      candidate.strictMonotonicIndex,
      DEFAULT_APP_SETTINGS.strictMonotonicIndex,
    ),
    requirePhotoHash: asBoolean(candidate.requirePhotoHash, DEFAULT_APP_SETTINGS.requirePhotoHash),
    emailNotificationsEnabled: asBoolean(
      candidate.emailNotificationsEnabled,
      DEFAULT_APP_SETTINGS.emailNotificationsEnabled,
    ),
    smsNotificationsEnabled: asBoolean(
      candidate.smsNotificationsEnabled,
      DEFAULT_APP_SETTINGS.smsNotificationsEnabled,
    ),
    pushNotificationsEnabled: asBoolean(
      candidate.pushNotificationsEnabled,
      DEFAULT_APP_SETTINGS.pushNotificationsEnabled,
    ),
    dailyDigestHour: asNumber(candidate.dailyDigestHour, DEFAULT_APP_SETTINGS.dailyDigestHour),
    maxImageSizeMb: asNumber(candidate.maxImageSizeMb, DEFAULT_APP_SETTINGS.maxImageSizeMb),
    retentionDays: asNumber(candidate.retentionDays, DEFAULT_APP_SETTINGS.retentionDays),
    allowedMimeTypes: asString(candidate.allowedMimeTypes, DEFAULT_APP_SETTINGS.allowedMimeTypes),
    accessTokenTtlMinutes: asNumber(
      candidate.accessTokenTtlMinutes,
      DEFAULT_APP_SETTINGS.accessTokenTtlMinutes,
    ),
    refreshTokenTtlDays: asNumber(
      candidate.refreshTokenTtlDays,
      DEFAULT_APP_SETTINGS.refreshTokenTtlDays,
    ),
    otpTtlMinutes: asNumber(candidate.otpTtlMinutes, DEFAULT_APP_SETTINGS.otpTtlMinutes),
    maxLoginAttempts: asNumber(candidate.maxLoginAttempts, DEFAULT_APP_SETTINGS.maxLoginAttempts),
    showOverviewValidationRate: asBoolean(
      candidate.showOverviewValidationRate,
      DEFAULT_APP_SETTINGS.showOverviewValidationRate,
    ),
    showOverviewActivityTrend: asBoolean(
      candidate.showOverviewActivityTrend,
      DEFAULT_APP_SETTINGS.showOverviewActivityTrend,
    ),
    showOverviewStatusMix: asBoolean(
      candidate.showOverviewStatusMix,
      DEFAULT_APP_SETTINGS.showOverviewStatusMix,
    ),
    showOverviewTasksByStatus: asBoolean(
      candidate.showOverviewTasksByStatus,
      DEFAULT_APP_SETTINGS.showOverviewTasksByStatus,
    ),
    showOverviewTopAgents: asBoolean(
      candidate.showOverviewTopAgents,
      DEFAULT_APP_SETTINGS.showOverviewTopAgents,
    ),
    showOverviewRiskiestZones: asBoolean(
      candidate.showOverviewRiskiestZones,
      DEFAULT_APP_SETTINGS.showOverviewRiskiestZones,
    ),
    showOverviewUserDistribution: asBoolean(
      candidate.showOverviewUserDistribution,
      DEFAULT_APP_SETTINGS.showOverviewUserDistribution,
    ),
    showOverviewOpsDelay: asBoolean(
      candidate.showOverviewOpsDelay,
      DEFAULT_APP_SETTINGS.showOverviewOpsDelay,
    ),
    showOverviewOpsBacklog: asBoolean(
      candidate.showOverviewOpsBacklog,
      DEFAULT_APP_SETTINGS.showOverviewOpsBacklog,
    ),
    showOverviewOpsAnomaly: asBoolean(
      candidate.showOverviewOpsAnomaly,
      DEFAULT_APP_SETTINGS.showOverviewOpsAnomaly,
    ),
    showOverviewOpsVolume: asBoolean(
      candidate.showOverviewOpsVolume,
      DEFAULT_APP_SETTINGS.showOverviewOpsVolume,
    ),
  };
}

export function mergeAppSettings(base: AppSettings, patch: unknown): AppSettings {
  const patchObj = asRecord(patch);
  if (!patchObj) return { ...base };
  return normalizeAppSettings({ ...base, ...patchObj });
}
