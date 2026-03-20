"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import { useAdminI18n } from "@/hooks/use-admin-i18n";
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
} from "@/lib/settings/appSettings";

type AppSettingsFormProps = {
  initialSettings: AppSettings;
};

export default function AppSettingsForm({ initialSettings }: AppSettingsFormProps) {
  const { locale, t } = useAdminI18n();
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [baseline, setBaseline] = useState<AppSettings>(initialSettings);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    return JSON.stringify(baseline) !== JSON.stringify(settings);
  }, [baseline, settings]);

  const localeCode = locale === "fr" ? "fr-FR" : locale === "ln" ? "ln-CG" : "en-US";

  const saveErrorLabel = useMemo(() => {
    if (!saveError) return null;
    if (saveError === "network_error") return t("settingsForm.errorNetwork");
    if (saveError === "save_failed") return t("settingsForm.errorSaveFailed");
    if (saveError === "invalid_request") return t("settingsForm.errorInvalidRequest");
    if (saveError === "admin_only_endpoint") return t("settingsForm.errorAdminOnly");
    return saveError;
  }, [saveError, t]);

  const saveSettings = async () => {
    setSaveError(null);
    setIsSaving(true);
    try {
      const response = await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const body = (await response.json().catch(() => null)) as
        | { settings?: AppSettings; error?: string }
        | null;

      if (!response.ok || !body?.settings) {
        setSaveError(body?.error || "save_failed");
        return;
      }

      setSettings(body.settings);
      setBaseline(body.settings);
      setSavedAt(new Date().toISOString());
    } catch {
      setSaveError("network_error");
    } finally {
      setIsSaving(false);
    }
  };

  const resetSettings = () => {
    setSettings(DEFAULT_APP_SETTINGS);
    setSaveError(null);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("settingsForm.generalTitle")}</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t("settingsForm.generalDescription")}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t("settingsForm.companyName")}>
            <Input
              value={settings.companyName}
              onChange={(e) => setSettings((prev) => ({ ...prev, companyName: e.target.value }))}
            />
          </Field>
          <Field label={t("settingsForm.defaultCountryCode")}>
            <Input
              value={settings.defaultCountryCode}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, defaultCountryCode: e.target.value.toUpperCase() }))
              }
            />
          </Field>
          <Field label={t("settingsForm.timezone")}>
            <Input
              value={settings.timezone}
              onChange={(e) => setSettings((prev) => ({ ...prev, timezone: e.target.value }))}
            />
          </Field>
          <Field label={t("settingsForm.locale")}>
            <Input
              value={settings.locale}
              onChange={(e) => setSettings((prev) => ({ ...prev, locale: e.target.value }))}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("settingsForm.readingWorkflowTitle")}</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Toggle
            label={t("settingsForm.requireGpsForReading")}
            checked={settings.requireGpsForReading}
            onChange={(checked) => setSettings((prev) => ({ ...prev, requireGpsForReading: checked }))}
          />
          <Toggle
            label={t("settingsForm.allowClientResubmission")}
            checked={settings.allowClientResubmission}
            onChange={(checked) => setSettings((prev) => ({ ...prev, allowClientResubmission: checked }))}
          />
          <Field label={t("settingsForm.maxGpsDistanceMeters")}>
            <Input
              type="number"
              value={settings.maxGpsDistanceMeters}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, maxGpsDistanceMeters: Number(e.target.value || "0") }))
              }
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("settingsForm.maxGpsDistanceHint")}
            </p>
          </Field>
          <Field label={t("settingsForm.reviewSlaHours")}>
            <Input
              type="number"
              value={settings.reviewSlaHours}
              onChange={(e) => setSettings((prev) => ({ ...prev, reviewSlaHours: Number(e.target.value || "0") }))}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
          {t("settingsForm.reminderWindowTitle")}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t("settingsForm.reminderWindowDescription")}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Toggle
            label={t("settingsForm.readingReminderEnabled")}
            checked={settings.readingReminderEnabled}
            onChange={(checked) => setSettings((prev) => ({ ...prev, readingReminderEnabled: checked }))}
          />
          <Field label={t("settingsForm.readingReminderTimezone")}>
            <Input
              value={settings.readingReminderTimezone}
              onChange={(e) => setSettings((prev) => ({ ...prev, readingReminderTimezone: e.target.value }))}
            />
          </Field>
          <Field label={t("settingsForm.readingWindowStartDay")}>
            <Input
              type="number"
              value={settings.readingWindowStartDay}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, readingWindowStartDay: Number(e.target.value || "1") }))
              }
            />
          </Field>
          <Field label={t("settingsForm.readingWindowEndDay")}>
            <Input
              type="number"
              value={settings.readingWindowEndDay}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, readingWindowEndDay: Number(e.target.value || "1") }))
              }
            />
          </Field>
          <Field label={t("settingsForm.readingReminderHour")}>
            <Input
              type="number"
              value={settings.readingReminderHour}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, readingReminderHour: Number(e.target.value || "0") }))
              }
            />
          </Field>
          <Field label={t("settingsForm.readingReminderCadence")}>
            <select
              value={settings.readingReminderCadence}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  readingReminderCadence: e.target.value as AppSettings["readingReminderCadence"],
                }))
              }
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="DAILY">{t("settingsForm.cadenceDaily")}</option>
              <option value="EVERY_2_DAYS">{t("settingsForm.cadenceEvery2Days")}</option>
              <option value="EVERY_3_DAYS">{t("settingsForm.cadenceEvery3Days")}</option>
            </select>
          </Field>
          <Field label={t("settingsForm.readingReminderMinIntervalHours")}>
            <Input
              type="number"
              value={settings.readingReminderMinIntervalHours}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  readingReminderMinIntervalHours: Number(e.target.value || "1"),
                }))
              }
            />
          </Field>
          <Field label={t("settingsForm.readingReminderMaxPerWindow")}>
            <Input
              type="number"
              value={settings.readingReminderMaxPerWindow}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  readingReminderMaxPerWindow: Number(e.target.value || "1"),
                }))
              }
            />
          </Field>
          <Toggle
            label={t("settingsForm.readingReminderUseWhatsapp")}
            checked={settings.readingReminderUseWhatsapp}
            onChange={(checked) =>
              setSettings((prev) => ({ ...prev, readingReminderUseWhatsapp: checked }))
            }
          />
          <Toggle
            label={t("settingsForm.readingReminderUseEmail")}
            checked={settings.readingReminderUseEmail}
            onChange={(checked) => setSettings((prev) => ({ ...prev, readingReminderUseEmail: checked }))}
          />
          <Toggle
            label={t("settingsForm.readingReminderUsePush")}
            checked={settings.readingReminderUsePush}
            onChange={(checked) => setSettings((prev) => ({ ...prev, readingReminderUsePush: checked }))}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("settingsForm.antiFraudTitle")}</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Toggle
            label={t("settingsForm.enableAnomalyScoring")}
            checked={settings.enableAnomalyScoring}
            onChange={(checked) => setSettings((prev) => ({ ...prev, enableAnomalyScoring: checked }))}
          />
          <Toggle
            label={t("settingsForm.strictMonotonicIndex")}
            checked={settings.strictMonotonicIndex}
            onChange={(checked) => setSettings((prev) => ({ ...prev, strictMonotonicIndex: checked }))}
          />
          <Toggle
            label={t("settingsForm.requirePhotoHash")}
            checked={settings.requirePhotoHash}
            onChange={(checked) => setSettings((prev) => ({ ...prev, requirePhotoHash: checked }))}
          />
          <Field label={t("settingsForm.anomalyThreshold")}>
            <Input
              type="number"
              value={settings.anomalyThreshold}
              onChange={(e) => setSettings((prev) => ({ ...prev, anomalyThreshold: Number(e.target.value || "0") }))}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("settingsForm.notificationsTitle")}</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t("settingsForm.emailApiProvider")}>
            <div className="flex flex-wrap items-center gap-6 rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-700">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="emailApiProvider"
                  value="RESEND"
                  checked={settings.emailApiProvider === "RESEND"}
                  onChange={() => setSettings((prev) => ({ ...prev, emailApiProvider: "RESEND" }))}
                  className="h-4 w-4 text-brand-500 focus:ring-brand-500"
                />
                {t("settingsForm.emailProviderResend")}
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="emailApiProvider"
                  value="MAILTRAP"
                  checked={settings.emailApiProvider === "MAILTRAP"}
                  onChange={() => setSettings((prev) => ({ ...prev, emailApiProvider: "MAILTRAP" }))}
                  className="h-4 w-4 text-brand-500 focus:ring-brand-500"
                />
                {t("settingsForm.emailProviderMailtrap")}
              </label>
            </div>
          </Field>
          <Toggle
            label={t("settingsForm.emailNotificationsEnabled")}
            checked={settings.emailNotificationsEnabled}
            onChange={(checked) => setSettings((prev) => ({ ...prev, emailNotificationsEnabled: checked }))}
          />
          <Toggle
            label={t("settingsForm.whatsappNotificationsEnabled")}
            checked={settings.whatsappNotificationsEnabled}
            onChange={(checked) =>
              setSettings((prev) => ({ ...prev, whatsappNotificationsEnabled: checked }))
            }
          />
          <Toggle
            label={t("settingsForm.pushNotificationsEnabled")}
            checked={settings.pushNotificationsEnabled}
            onChange={(checked) => setSettings((prev) => ({ ...prev, pushNotificationsEnabled: checked }))}
          />
          <Field label={t("settingsForm.dailyDigestHour")}>
            <Input
              type="number"
              value={settings.dailyDigestHour}
              onChange={(e) => setSettings((prev) => ({ ...prev, dailyDigestHour: Number(e.target.value || "0") }))}
            />
          </Field>
          <Field label={t("settingsForm.maxImageSizeMb")}>
            <Input
              type="number"
              value={settings.maxImageSizeMb}
              onChange={(e) => setSettings((prev) => ({ ...prev, maxImageSizeMb: Number(e.target.value || "0") }))}
            />
          </Field>
          <Field label={t("settingsForm.retentionDays")}>
            <Input
              type="number"
              value={settings.retentionDays}
              onChange={(e) => setSettings((prev) => ({ ...prev, retentionDays: Number(e.target.value || "0") }))}
            />
          </Field>
          <Field label={t("settingsForm.allowedMimeTypes")}>
            <Input
              value={settings.allowedMimeTypes}
              onChange={(e) => setSettings((prev) => ({ ...prev, allowedMimeTypes: e.target.value }))}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("settingsForm.overviewChartsTitle")}</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t("settingsForm.overviewChartsDescription")}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Toggle
            label={t("settingsForm.showOverviewValidationRate")}
            checked={settings.showOverviewValidationRate}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewValidationRate: checked }))}
          />
          <Toggle
            label={t("settingsForm.showOverviewActivityTrend")}
            checked={settings.showOverviewActivityTrend}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewActivityTrend: checked }))}
          />
          <Toggle
            label={t("settingsForm.showOverviewStatusMix")}
            checked={settings.showOverviewStatusMix}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewStatusMix: checked }))}
          />
          <Toggle
            label={t("settingsForm.showOverviewTasksByStatus")}
            checked={settings.showOverviewTasksByStatus}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewTasksByStatus: checked }))}
          />
          <Toggle
            label={t("settingsForm.showOverviewTopAgents")}
            checked={settings.showOverviewTopAgents}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewTopAgents: checked }))}
          />
          <Toggle
            label={t("settingsForm.showOverviewRiskiestZones")}
            checked={settings.showOverviewRiskiestZones}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewRiskiestZones: checked }))}
          />
          <Toggle
            label={t("settingsForm.showOverviewUserDistribution")}
            checked={settings.showOverviewUserDistribution}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewUserDistribution: checked }))}
          />
          <Toggle
            label={t("settingsForm.showOverviewOpsDelay")}
            checked={settings.showOverviewOpsDelay}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewOpsDelay: checked }))}
          />
          <Toggle
            label={t("settingsForm.showOverviewOpsBacklog")}
            checked={settings.showOverviewOpsBacklog}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewOpsBacklog: checked }))}
          />
          <Toggle
            label={t("settingsForm.showOverviewOpsAnomaly")}
            checked={settings.showOverviewOpsAnomaly}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewOpsAnomaly: checked }))}
          />
          <Toggle
            label={t("settingsForm.showOverviewOpsVolume")}
            checked={settings.showOverviewOpsVolume}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewOpsVolume: checked }))}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("settingsForm.securityTitle")}</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t("settingsForm.accessTokenTtlMinutes")}>
            <Input
              type="number"
              value={settings.accessTokenTtlMinutes}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, accessTokenTtlMinutes: Number(e.target.value || "0") }))
              }
            />
          </Field>
          <Field label={t("settingsForm.refreshTokenTtlDays")}>
            <Input
              type="number"
              value={settings.refreshTokenTtlDays}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, refreshTokenTtlDays: Number(e.target.value || "0") }))
              }
            />
          </Field>
          <Field label={t("settingsForm.otpTtlMinutes")}>
            <Input
              type="number"
              value={settings.otpTtlMinutes}
              onChange={(e) => setSettings((prev) => ({ ...prev, otpTtlMinutes: Number(e.target.value || "0") }))}
            />
          </Field>
          <Field label={t("settingsForm.maxLoginAttempts")}>
            <Input
              type="number"
              value={settings.maxLoginAttempts}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, maxLoginAttempts: Number(e.target.value || "0") }))
              }
            />
          </Field>
        </div>
      </section>

      <div className="sticky bottom-4 z-30 rounded-xl border border-gray-200 bg-white/90 p-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {savedAt
                ? t("settingsForm.savedAt", { date: new Date(savedAt).toLocaleString(localeCode) })
                : t("settingsForm.pendingChanges")}
            </p>
            {saveError ? (
              <p className="mt-1 text-xs text-error-600 dark:text-error-400">
                {t("settingsForm.saveFailed", { error: saveErrorLabel || saveError })}
              </p>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={resetSettings}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
            >
              {t("settingsForm.resetDefaults")}
            </button>
            <button
              type="button"
              onClick={saveSettings}
              disabled={!isDirty || isSaving}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? t("settingsForm.saving") : t("settingsForm.saveSettings")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-700"
        }`}
        aria-pressed={checked}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}
