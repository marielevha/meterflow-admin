"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
} from "@/lib/settings/appSettings";

type AppSettingsFormProps = {
  initialSettings: AppSettings;
};

export default function AppSettingsForm({ initialSettings }: AppSettingsFormProps) {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [baseline, setBaseline] = useState<AppSettings>(initialSettings);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    return JSON.stringify(baseline) !== JSON.stringify(settings);
  }, [baseline, settings]);

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
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">General</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Parametres globaux de l&apos;application et du contexte regional.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Company name">
            <Input
              value={settings.companyName}
              onChange={(e) => setSettings((prev) => ({ ...prev, companyName: e.target.value }))}
            />
          </Field>
          <Field label="Default country code (ISO)">
            <Input
              value={settings.defaultCountryCode}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, defaultCountryCode: e.target.value.toUpperCase() }))
              }
            />
          </Field>
          <Field label="Timezone">
            <Input
              value={settings.timezone}
              onChange={(e) => setSettings((prev) => ({ ...prev, timezone: e.target.value }))}
            />
          </Field>
          <Field label="Locale">
            <Input
              value={settings.locale}
              onChange={(e) => setSettings((prev) => ({ ...prev, locale: e.target.value }))}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Reading workflow</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Toggle
            label="Require GPS for reading"
            checked={settings.requireGpsForReading}
            onChange={(checked) => setSettings((prev) => ({ ...prev, requireGpsForReading: checked }))}
          />
          <Toggle
            label="Allow client resubmission"
            checked={settings.allowClientResubmission}
            onChange={(checked) => setSettings((prev) => ({ ...prev, allowClientResubmission: checked }))}
          />
          <Field label="Max GPS distance (meters)">
            <Input
              type="number"
              value={settings.maxGpsDistanceMeters}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, maxGpsDistanceMeters: Number(e.target.value || "0") }))
              }
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Utilise pour l&apos;alerte mobile et pour le controle officiel backend/admin.
            </p>
          </Field>
          <Field label="Review SLA (hours)">
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
          Reading reminder window
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure la periode mensuelle de relance client pour l&apos;auto-releve (ex: du 20 au 5).
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Toggle
            label="Enable client reminders"
            checked={settings.readingReminderEnabled}
            onChange={(checked) => setSettings((prev) => ({ ...prev, readingReminderEnabled: checked }))}
          />
          <Field label="Reminder timezone">
            <Input
              value={settings.readingReminderTimezone}
              onChange={(e) => setSettings((prev) => ({ ...prev, readingReminderTimezone: e.target.value }))}
            />
          </Field>
          <Field label="Window start day (1-31)">
            <Input
              type="number"
              value={settings.readingWindowStartDay}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, readingWindowStartDay: Number(e.target.value || "1") }))
              }
            />
          </Field>
          <Field label="Window end day (1-31)">
            <Input
              type="number"
              value={settings.readingWindowEndDay}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, readingWindowEndDay: Number(e.target.value || "1") }))
              }
            />
          </Field>
          <Field label="Reminder hour (0-23)">
            <Input
              type="number"
              value={settings.readingReminderHour}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, readingReminderHour: Number(e.target.value || "0") }))
              }
            />
          </Field>
          <Field label="Reminder cadence">
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
              <option value="DAILY">Daily</option>
              <option value="EVERY_2_DAYS">Every 2 days</option>
              <option value="EVERY_3_DAYS">Every 3 days</option>
            </select>
          </Field>
          <Field label="Min interval between reminders (hours)">
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
          <Field label="Max reminders per window">
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
            label="Use WhatsApp channel"
            checked={settings.readingReminderUseWhatsapp}
            onChange={(checked) =>
              setSettings((prev) => ({ ...prev, readingReminderUseWhatsapp: checked }))
            }
          />
          <Toggle
            label="Use Email channel"
            checked={settings.readingReminderUseEmail}
            onChange={(checked) => setSettings((prev) => ({ ...prev, readingReminderUseEmail: checked }))}
          />
          <Toggle
            label="Use Push channel"
            checked={settings.readingReminderUsePush}
            onChange={(checked) => setSettings((prev) => ({ ...prev, readingReminderUsePush: checked }))}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Anti-fraud</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Toggle
            label="Enable anomaly scoring"
            checked={settings.enableAnomalyScoring}
            onChange={(checked) => setSettings((prev) => ({ ...prev, enableAnomalyScoring: checked }))}
          />
          <Toggle
            label="Strict monotonic index check"
            checked={settings.strictMonotonicIndex}
            onChange={(checked) => setSettings((prev) => ({ ...prev, strictMonotonicIndex: checked }))}
          />
          <Toggle
            label="Require photo hash validation"
            checked={settings.requirePhotoHash}
            onChange={(checked) => setSettings((prev) => ({ ...prev, requirePhotoHash: checked }))}
          />
          <Field label="Anomaly threshold (0-100)">
            <Input
              type="number"
              value={settings.anomalyThreshold}
              onChange={(e) => setSettings((prev) => ({ ...prev, anomalyThreshold: Number(e.target.value || "0") }))}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Notifications & storage</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Email API provider">
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
                Resend
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
                Mailtrap
              </label>
            </div>
          </Field>
          <Toggle
            label="Email notifications"
            checked={settings.emailNotificationsEnabled}
            onChange={(checked) => setSettings((prev) => ({ ...prev, emailNotificationsEnabled: checked }))}
          />
          <Toggle
            label="WhatsApp notifications"
            checked={settings.whatsappNotificationsEnabled}
            onChange={(checked) =>
              setSettings((prev) => ({ ...prev, whatsappNotificationsEnabled: checked }))
            }
          />
          <Toggle
            label="Push notifications"
            checked={settings.pushNotificationsEnabled}
            onChange={(checked) => setSettings((prev) => ({ ...prev, pushNotificationsEnabled: checked }))}
          />
          <Field label="Daily digest hour (0-23)">
            <Input
              type="number"
              value={settings.dailyDigestHour}
              onChange={(e) => setSettings((prev) => ({ ...prev, dailyDigestHour: Number(e.target.value || "0") }))}
            />
          </Field>
          <Field label="Max image size (MB)">
            <Input
              type="number"
              value={settings.maxImageSizeMb}
              onChange={(e) => setSettings((prev) => ({ ...prev, maxImageSizeMb: Number(e.target.value || "0") }))}
            />
          </Field>
          <Field label="Retention days">
            <Input
              type="number"
              value={settings.retentionDays}
              onChange={(e) => setSettings((prev) => ({ ...prev, retentionDays: Number(e.target.value || "0") }))}
            />
          </Field>
          <Field label="Allowed MIME types (comma-separated)">
            <Input
              value={settings.allowedMimeTypes}
              onChange={(e) => setSettings((prev) => ({ ...prev, allowedMimeTypes: e.target.value }))}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Overview charts visibility</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Choisissez les graphiques a afficher sur la page Overview.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Toggle
            label="Validation rate trend"
            checked={settings.showOverviewValidationRate}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewValidationRate: checked }))}
          />
          <Toggle
            label="Activity trend"
            checked={settings.showOverviewActivityTrend}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewActivityTrend: checked }))}
          />
          <Toggle
            label="Status mix"
            checked={settings.showOverviewStatusMix}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewStatusMix: checked }))}
          />
          <Toggle
            label="Tasks by status"
            checked={settings.showOverviewTasksByStatus}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewTasksByStatus: checked }))}
          />
          <Toggle
            label="Top agents"
            checked={settings.showOverviewTopAgents}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewTopAgents: checked }))}
          />
          <Toggle
            label="Riskiest zones"
            checked={settings.showOverviewRiskiestZones}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewRiskiestZones: checked }))}
          />
          <Toggle
            label="User distribution"
            checked={settings.showOverviewUserDistribution}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewUserDistribution: checked }))}
          />
          <Toggle
            label="Ops KPI - delay"
            checked={settings.showOverviewOpsDelay}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewOpsDelay: checked }))}
          />
          <Toggle
            label="Ops KPI - backlog"
            checked={settings.showOverviewOpsBacklog}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewOpsBacklog: checked }))}
          />
          <Toggle
            label="Ops KPI - anomalies"
            checked={settings.showOverviewOpsAnomaly}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewOpsAnomaly: checked }))}
          />
          <Toggle
            label="Ops KPI - volume"
            checked={settings.showOverviewOpsVolume}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showOverviewOpsVolume: checked }))}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Security</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Access token TTL (minutes)">
            <Input
              type="number"
              value={settings.accessTokenTtlMinutes}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, accessTokenTtlMinutes: Number(e.target.value || "0") }))
              }
            />
          </Field>
          <Field label="Refresh token TTL (days)">
            <Input
              type="number"
              value={settings.refreshTokenTtlDays}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, refreshTokenTtlDays: Number(e.target.value || "0") }))
              }
            />
          </Field>
          <Field label="OTP TTL (minutes)">
            <Input
              type="number"
              value={settings.otpTtlMinutes}
              onChange={(e) => setSettings((prev) => ({ ...prev, otpTtlMinutes: Number(e.target.value || "0") }))}
            />
          </Field>
          <Field label="Max login attempts">
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
                ? `Saved at ${new Date(savedAt).toLocaleString()}`
                : "Changes are pending until you save."}
            </p>
            {saveError ? (
              <p className="mt-1 text-xs text-error-600 dark:text-error-400">
                Save failed: {saveError}
              </p>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={resetSettings}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
            >
              Reset defaults
            </button>
            <button
              type="button"
              onClick={saveSettings}
              disabled={!isDirty || isSaving}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save settings"}
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
