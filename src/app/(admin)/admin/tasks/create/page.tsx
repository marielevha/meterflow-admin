import { Metadata } from "next";
import Link from "next/link";
import { TaskPriority, TaskStatus, TaskType, UserRole, UserStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import SearchableSelect from "@/components/form/SearchableSelect";
import {
  translateReadingStatus,
  translateTaskPriority,
  translateTaskStatus,
  translateTaskType,
} from "@/lib/admin-i18n/labels";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import { getCurrentStaffFromServerAction } from "@/lib/auth/staffActionSession";
import { prisma } from "@/lib/prisma";
import { createTaskAction } from "./actions";

export const metadata: Metadata = {
  title: "Create Task",
  description: "Create operational task",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function normalizeEnum<T extends string>(value: string, options: readonly T[], fallback: T): T {
  return (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

function mapError(code: string, t: (key: string) => string) {
  if (code === "insufficient_role") return t("tasks.errorInsufficientCreateRole");
  if (code === "title_required") return t("tasks.errorTitleRequired");
  if (code === "meter_or_reading_required") return t("tasks.errorMeterOrReadingRequired");
  if (code === "assigned_agent_not_found") return t("tasks.errorAssignedAgentNotFound");
  if (code === "meter_not_found") return t("tasks.errorMeterNotFound");
  if (code === "reading_not_found") return t("tasks.errorReadingNotFound");
  if (code === "meter_reading_mismatch") return t("tasks.errorMeterReadingMismatch");
  return code ? t("tasks.errorUpdateFailed") : "";
}

export default async function CreateTaskPage({ searchParams }: { searchParams: SearchParams }) {
  const { t } = await getAdminTranslator();
  const staff = await getCurrentStaffFromServerAction();
  if (!staff) redirect("/signin");

  const resolved = await searchParams;
  const errorCode = firstValue(resolved.error);
  const prefillReadingId = firstValue(resolved.readingId).trim();
  const prefillMeterId = firstValue(resolved.meterId).trim();
  const prefillTitle = firstValue(resolved.title).trim();
  const prefillDescription = firstValue(resolved.description).trim();
  const prefillAssignedToId = firstValue(resolved.assignedToId).trim();
  const prefillDueAt = firstValue(resolved.dueAt).trim();
  const prefillType = normalizeEnum(
    firstValue(resolved.type).trim(),
    Object.values(TaskType),
    TaskType.GENERAL,
  );
  const prefillPriority = normalizeEnum(
    firstValue(resolved.priority).trim(),
    Object.values(TaskPriority),
    TaskPriority.MEDIUM,
  );
  const prefillStatus = normalizeEnum(
    firstValue(resolved.status).trim(),
    Object.values(TaskStatus),
    TaskStatus.OPEN,
  );

  const [meters, readings, agents] = await prisma.$transaction([
    prisma.meter.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, serialNumber: true, meterReference: true },
    }),
    prisma.reading.findMany({
      where: { deletedAt: null },
      orderBy: { readingAt: "desc" },
      take: 200,
      select: {
        id: true,
        status: true,
        readingAt: true,
        meter: { select: { serialNumber: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        role: UserRole.AGENT,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, phone: true },
    }),
  ]);

  const errorMessage = mapError(errorCode, t);

  return (
    <div>
      <PageBreadcrumb pageTitle={t("tasks.createPageTitle")} />

      <form action={createTaskAction} className="space-y-6">
        {errorMessage ? (
          <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
            {errorMessage}
          </div>
        ) : null}
        {prefillReadingId ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
            {t("tasks.prefilledFromReading", { id: prefillReadingId.slice(0, 8) })}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <QuickInfo label={t("tasks.availableMeters")} value={meters.length} />
          <QuickInfo label={t("tasks.recentReadingsCount")} value={readings.length} />
          <QuickInfo label={t("tasks.activeAgentsCount")} value={agents.length} />
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("tasks.coreDetailsTitle")}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("tasks.coreDetailsDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="title">{t("common.title")} *</Label>
              <Input
                id="title"
                name="title"
                defaultValue={prefillTitle}
                placeholder={t("tasks.titlePlaceholder")}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("tasks.titleHint")}</p>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description">{t("common.description")}</Label>
              <textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={prefillDescription}
                className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                placeholder={t("tasks.descriptionPlaceholder")}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("tasks.scopeLinkageTitle")}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("tasks.scopeLinkageDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="meterId">{t("common.meter")}</Label>
              <SearchableSelect
                id="meterId"
                name="meterId"
                defaultValue={prefillMeterId}
                emptyLabel={t("common.notAvailable")}
                placeholder={t("tasks.meterSearchPlaceholder")}
                options={meters.map((meter) => ({
                  value: meter.id,
                  label: meter.serialNumber,
                  hint: meter.meterReference || "-",
                }))}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("tasks.meterLinkHint")}
              </p>
            </div>

            <div>
              <Label htmlFor="readingId">{t("history.reading")}</Label>
              <SearchableSelect
                id="readingId"
                name="readingId"
                defaultValue={prefillReadingId}
                emptyLabel={t("common.notAvailable")}
                placeholder={t("tasks.readingSearchPlaceholder")}
                options={readings.map((reading) => ({
                  value: reading.id,
                  label: `${reading.meter.serialNumber} • ${translateReadingStatus(reading.status, t)}`,
                  hint: reading.readingAt.toISOString().slice(0, 16).replace("T", " "),
                }))}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("tasks.readingLinkHint")}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("tasks.executionSetupTitle")}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("tasks.executionSetupDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="assignedToId">{t("tasks.tableAssignee")}</Label>
              <SearchableSelect
                id="assignedToId"
                name="assignedToId"
                defaultValue={prefillAssignedToId}
                emptyLabel={t("tasks.unassigned")}
                placeholder={t("meters.searchAgentPlaceholder")}
                options={agents.map((agent) => ({
                  value: agent.id,
                  label: [agent.firstName, agent.lastName].filter(Boolean).join(" ").trim() || t("users.roleAgent"),
                  hint: agent.phone,
                }))}
              />
            </div>

            <div>
              <Label htmlFor="dueAt">{t("tasks.dueAt")}</Label>
              <Input id="dueAt" name="dueAt" type="datetime-local" defaultValue={prefillDueAt} />
            </div>

            <div>
              <Label htmlFor="type">{t("common.type")}</Label>
              <select
                id="type"
                name="type"
                defaultValue={prefillType}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                {Object.values(TaskType).map((item) => (
                  <option key={item} value={item}>{translateTaskType(item, t)}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="priority">{t("common.priority")}</Label>
              <select
                id="priority"
                name="priority"
                defaultValue={prefillPriority}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                {Object.values(TaskPriority).map((item) => (
                  <option key={item} value={item}>{translateTaskPriority(item, t)}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="status">{t("tasks.initialStatus")}</Label>
              <select
                id="status"
                name="status"
                defaultValue={prefillStatus}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                {Object.values(TaskStatus).map((item) => (
                  <option key={item} value={item}>{translateTaskStatus(item, t)}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <div className="sticky bottom-4 z-30 rounded-xl border border-gray-200 bg-white/90 p-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("tasks.createTip")}
            </p>
            <div className="flex items-center justify-end gap-2">
              <Link href="/admin/tasks" className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]">{t("common.cancel")}</Link>
              <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600">{t("tasks.createTask")}</button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function QuickInfo({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}
