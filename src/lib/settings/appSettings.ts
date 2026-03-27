export const APP_SETTINGS_DB_KEY = "global";

export type EmailApiProvider = "RESEND" | "MAILTRAP";

export type AppSettings = {
  companyName: string;
  defaultCountryCode: string;
  timezone: string;
  locale: string;
  requireGpsForReading: boolean;
  maxGpsDistanceMeters: number;
  allowClientResubmission: boolean;
  reviewSlaHours: number;
  readingReminderEnabled: boolean;
  readingWindowStartDay: number;
  readingWindowEndDay: number;
  readingReminderHour: number;
  readingReminderTimezone: string;
  readingReminderCadence: "DAILY" | "EVERY_2_DAYS" | "EVERY_3_DAYS";
  readingReminderMinIntervalHours: number;
  readingReminderMaxPerWindow: number;
  readingReminderUseWhatsapp: boolean;
  readingReminderUseEmail: boolean;
  readingReminderUsePush: boolean;
  enableAnomalyScoring: boolean;
  anomalyThreshold: number;
  strictMonotonicIndex: boolean;
  requirePhotoHash: boolean;
  emailApiProvider: EmailApiProvider;
  emailNotificationsEnabled: boolean;
  whatsappNotificationsEnabled: boolean;
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
  companyName: "E2C",
  defaultCountryCode: "CG",
  timezone: "Africa/Brazzaville",
  locale: "fr-FR",
  requireGpsForReading: true,
  maxGpsDistanceMeters: 200,
  allowClientResubmission: true,
  reviewSlaHours: 24,
  readingReminderEnabled: true,
  readingWindowStartDay: 20,
  readingWindowEndDay: 5,
  readingReminderHour: 9,
  readingReminderTimezone: "Africa/Brazzaville",
  readingReminderCadence: "DAILY",
  readingReminderMinIntervalHours: 24,
  readingReminderMaxPerWindow: 3,
  readingReminderUseWhatsapp: true,
  readingReminderUseEmail: true,
  readingReminderUsePush: false,
  enableAnomalyScoring: true,
  anomalyThreshold: 65,
  strictMonotonicIndex: true,
  requirePhotoHash: true,
  emailApiProvider: "RESEND",
  emailNotificationsEnabled: true,
  whatsappNotificationsEnabled: false,
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

function clampInt(value: number, min: number, max: number, fallback: number) {
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded)) return fallback;
  return Math.min(max, Math.max(min, rounded));
}

function asCadence(
  value: unknown,
  fallback: AppSettings["readingReminderCadence"],
): AppSettings["readingReminderCadence"] {
  if (value === "DAILY" || value === "EVERY_2_DAYS" || value === "EVERY_3_DAYS") {
    return value;
  }
  return fallback;
}

function asEmailApiProvider(value: unknown, fallback: EmailApiProvider): EmailApiProvider {
  if (value === "RESEND" || value === "MAILTRAP") return value;
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
    readingReminderEnabled: asBoolean(
      candidate.readingReminderEnabled,
      DEFAULT_APP_SETTINGS.readingReminderEnabled,
    ),
    readingWindowStartDay: clampInt(
      asNumber(candidate.readingWindowStartDay, DEFAULT_APP_SETTINGS.readingWindowStartDay),
      1,
      31,
      DEFAULT_APP_SETTINGS.readingWindowStartDay,
    ),
    readingWindowEndDay: clampInt(
      asNumber(candidate.readingWindowEndDay, DEFAULT_APP_SETTINGS.readingWindowEndDay),
      1,
      31,
      DEFAULT_APP_SETTINGS.readingWindowEndDay,
    ),
    readingReminderHour: clampInt(
      asNumber(candidate.readingReminderHour, DEFAULT_APP_SETTINGS.readingReminderHour),
      0,
      23,
      DEFAULT_APP_SETTINGS.readingReminderHour,
    ),
    readingReminderTimezone: asString(
      candidate.readingReminderTimezone,
      DEFAULT_APP_SETTINGS.readingReminderTimezone,
    ),
    readingReminderCadence: asCadence(
      candidate.readingReminderCadence,
      DEFAULT_APP_SETTINGS.readingReminderCadence,
    ),
    readingReminderMinIntervalHours: clampInt(
      asNumber(
        candidate.readingReminderMinIntervalHours,
        DEFAULT_APP_SETTINGS.readingReminderMinIntervalHours,
      ),
      1,
      168,
      DEFAULT_APP_SETTINGS.readingReminderMinIntervalHours,
    ),
    readingReminderMaxPerWindow: clampInt(
      asNumber(
        candidate.readingReminderMaxPerWindow,
        DEFAULT_APP_SETTINGS.readingReminderMaxPerWindow,
      ),
      1,
      31,
      DEFAULT_APP_SETTINGS.readingReminderMaxPerWindow,
    ),
    readingReminderUseWhatsapp: asBoolean(
      candidate.readingReminderUseWhatsapp ?? candidate.readingReminderUseSms,
      DEFAULT_APP_SETTINGS.readingReminderUseWhatsapp,
    ),
    readingReminderUseEmail: asBoolean(
      candidate.readingReminderUseEmail,
      DEFAULT_APP_SETTINGS.readingReminderUseEmail,
    ),
    readingReminderUsePush: asBoolean(
      candidate.readingReminderUsePush,
      DEFAULT_APP_SETTINGS.readingReminderUsePush,
    ),
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
    emailApiProvider: asEmailApiProvider(
      candidate.emailApiProvider,
      DEFAULT_APP_SETTINGS.emailApiProvider,
    ),
    emailNotificationsEnabled: asBoolean(
      candidate.emailNotificationsEnabled,
      DEFAULT_APP_SETTINGS.emailNotificationsEnabled,
    ),
    whatsappNotificationsEnabled: asBoolean(
      candidate.whatsappNotificationsEnabled ?? candidate.smsNotificationsEnabled,
      DEFAULT_APP_SETTINGS.whatsappNotificationsEnabled,
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

  const normalizedPatch = { ...patchObj };
  if (
    typeof normalizedPatch.readingReminderUseSms === "boolean" &&
    typeof normalizedPatch.readingReminderUseWhatsapp !== "boolean"
  ) {
    normalizedPatch.readingReminderUseWhatsapp = normalizedPatch.readingReminderUseSms;
  }
  if (
    typeof normalizedPatch.smsNotificationsEnabled === "boolean" &&
    typeof normalizedPatch.whatsappNotificationsEnabled !== "boolean"
  ) {
    normalizedPatch.whatsappNotificationsEnabled = normalizedPatch.smsNotificationsEnabled;
  }

  return normalizeAppSettings({ ...base, ...normalizedPatch });
}
