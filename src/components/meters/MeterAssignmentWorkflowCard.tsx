"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import SearchableSelect from "@/components/form/SearchableSelect";
import { useAdminI18n } from "@/hooks/use-admin-i18n";
import { transferMeterAssignmentAction } from "@/app/(admin)/admin/meters/[id]/actions";

type CustomerOption = {
  value: string;
  label: string;
  hint?: string;
};

type MeterAssignmentWorkflowCardProps = {
  meterId: string;
  serialNumber: string;
  canManage: boolean;
  currentAssignment: {
    customerId: string;
    customerName: string;
    customerPhone: string | null;
    assignedAt: string;
    sourceLabel: string;
    notes: string | null;
  } | null;
  blockers: {
    pendingReadings: number;
    activeTasks: number;
    draftInvoices: number;
    hasBlockers: boolean;
  };
  customerOptions: CustomerOption[];
  history: Array<{
    id: string;
    customerName: string;
    customerPhone: string | null;
    assignedAt: string;
    endedAt: string | null;
    sourceLabel: string;
    notes: string | null;
    assignedByName: string | null;
    endedByName: string | null;
    isActive: boolean;
  }>;
};

export default function MeterAssignmentWorkflowCard({
  meterId,
  serialNumber,
  canManage,
  currentAssignment,
  blockers,
  customerOptions,
  history,
}: MeterAssignmentWorkflowCardProps) {
  const router = useRouter();
  const { t } = useAdminI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<{
    outcome: "assigned" | "transferred";
    customerName: string;
    serialNumber: string;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const actionLabel = currentAssignment ? t("meters.transferAction") : t("meters.assignAction");
  const modalTitle = currentAssignment ? t("meters.transferModalTitle") : t("meters.assignModalTitle");
  const submitLabel = currentAssignment ? t("meters.confirmTransfer") : t("meters.confirmAssign");

  const blockerLines = useMemo(() => {
    const items: string[] = [];
    if (blockers.pendingReadings > 0) {
      items.push(t("meters.transferBlockedReadings", { count: blockers.pendingReadings }));
    }
    if (blockers.activeTasks > 0) {
      items.push(t("meters.transferBlockedTasks", { count: blockers.activeTasks }));
    }
    if (blockers.draftInvoices > 0) {
      items.push(t("meters.transferBlockedInvoices", { count: blockers.draftInvoices }));
    }
    return items;
  }, [blockers.activeTasks, blockers.draftInvoices, blockers.pendingReadings, t]);

  const submitTransfer = () => {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);

    startTransition(async () => {
      const result = await transferMeterAssignmentAction(meterId, formData);
      if (!result.ok) {
        if (result.error === "transfer_blocked_by_active_cycle" && result.blockers) {
          const parts = [
            result.blockers.pendingReadings
              ? t("meters.transferBlockedReadings", { count: result.blockers.pendingReadings })
              : null,
            result.blockers.activeTasks
              ? t("meters.transferBlockedTasks", { count: result.blockers.activeTasks })
              : null,
            result.blockers.draftInvoices
              ? t("meters.transferBlockedInvoices", { count: result.blockers.draftInvoices })
              : null,
          ].filter(Boolean);
          setError(parts.join(" · "));
          return;
        }

        setError(mapError(result.error, t));
        return;
      }

      setSuccessState({
        outcome: result.outcome,
        customerName: result.customerName,
        serialNumber: result.serialNumber,
      });
      setIsOpen(false);
      setSuccessOpen(true);
      formRef.current?.reset();
      router.refresh();
    });
  };

  return (
    <>
      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:col-span-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              {t("meters.assignmentWorkflowTitle")}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("meters.assignmentWorkflowDescription")}
            </p>
          </div>
          {canManage ? (
            <Button
              size="sm"
              onClick={() => {
                setError(null);
                setIsOpen(true);
              }}
              disabled={isPending || blockers.hasBlockers}
              className="shrink-0"
            >
              {actionLabel}
            </Button>
          ) : null}
        </div>

        {blockers.hasBlockers ? (
          <div className="mt-5 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200">
            <p className="font-medium">{t("meters.transferBlockedTitle")}</p>
            <p className="mt-1">{t("meters.transferBlockedBody")}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              {blockerLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-white/[0.02]">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t("meters.currentAssignmentTitle")}
            </p>
            {currentAssignment ? (
              <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <p className="font-medium text-gray-800 dark:text-white/90">{currentAssignment.customerName}</p>
                <p>{currentAssignment.customerPhone || t("common.notAvailable")}</p>
                <p>
                  {t("meters.assignmentDateLabel")}: {formatDate(currentAssignment.assignedAt)}
                </p>
                <p>
                  {t("meters.assignmentSourceLabel")}:{" "}
                  {currentAssignment.sourceLabel}
                </p>
                <p>
                  {t("meters.assignmentNotesLabel")}:{" "}
                  {currentAssignment.notes || t("common.notAvailable")}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                {t("meters.noCurrentAssignment")}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-white/[0.02]">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t("meters.assignmentHistoryTitle")}
            </p>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                {t("meters.noAssignmentHistory")}
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-900/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {entry.customerName}
                      </p>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          entry.isActive
                            ? "bg-success-100 text-success-700 dark:bg-success-500/10 dark:text-success-300"
                            : "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {entry.isActive ? t("meters.assignmentActiveBadge") : t("meters.assignmentEndedBadge")}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <p>{entry.customerPhone || t("common.notAvailable")}</p>
                      <p>
                        {t("meters.assignmentDateLabel")}: {formatDate(entry.assignedAt)}
                      </p>
                      <p>
                        {t("meters.assignmentEndDateLabel")}:{" "}
                        {entry.endedAt ? formatDate(entry.endedAt) : t("common.notAvailable")}
                      </p>
                      <p>
                        {t("meters.assignmentSourceLabel")}:{" "}
                        {entry.sourceLabel}
                      </p>
                      <p>
                        {t("meters.assignmentAssignedByLabel")}:{" "}
                        {entry.assignedByName || t("common.notAvailable")}
                      </p>
                      <p>
                        {t("meters.assignmentEndedByLabel")}:{" "}
                        {entry.endedByName || t("common.notAvailable")}
                      </p>
                      <p>
                        {t("meters.assignmentNotesLabel")}:{" "}
                        {entry.notes || t("common.notAvailable")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <Modal
        isOpen={isOpen}
        onClose={() => {
          if (!isPending) {
            setError(null);
            setIsOpen(false);
          }
        }}
        showCloseButton={!isPending}
        className="max-w-[560px] p-6 lg:p-8"
      >
        <div className="space-y-6">
          <div>
            <h4 className="text-xl font-semibold text-gray-800 dark:text-white/90">{modalTitle}</h4>
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
              {currentAssignment
                ? t("meters.transferModalDescription", { serial: serialNumber })
                : t("meters.assignModalDescription", { serial: serialNumber })}
            </p>
          </div>

          <form ref={formRef} className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("meters.currentAssignmentTitle")}
              </p>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-300">
                {currentAssignment ? currentAssignment.customerName : t("meters.noCurrentAssignment")}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("meters.transferTargetLabel")}
              </label>
              <SearchableSelect
                name="customerId"
                defaultValue=""
                options={customerOptions}
                placeholder={t("meters.searchCustomerPlaceholder")}
                noResultsLabel={t("common.noResults")}
              />
            </div>

            <div>
              <label
                htmlFor="transfer-notes"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t("meters.transferNotesLabel")}
              </label>
              <textarea
                id="transfer-notes"
                name="notes"
                rows={4}
                placeholder={t("meters.transferNotesPlaceholder")}
                className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </div>
          </form>

          {error ? (
            <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setError(null);
                setIsOpen(false);
              }}
              disabled={isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button size="sm" onClick={submitTransfer} disabled={isPending}>
              {isPending ? t("settingsForm.saving") : submitLabel}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={successOpen}
        onClose={() => setSuccessOpen(false)}
        showCloseButton={false}
        className="max-w-[420px] p-6 lg:p-8"
      >
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-100 text-success-600 dark:bg-success-500/10 dark:text-success-300">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 7L9 18L4 13"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h4 className="mt-5 text-2xl font-semibold text-gray-800 dark:text-white/90">
            {successState?.outcome === "assigned"
              ? t("meters.assignmentSuccessTitle")
              : t("meters.transferSuccessTitle")}
          </h4>
          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {successState?.outcome === "assigned"
              ? t("meters.assignmentSuccessBody", {
                  serial: successState.serialNumber,
                  customer: successState.customerName,
                })
              : t("meters.transferSuccessBody", {
                  serial: successState?.serialNumber || serialNumber,
                  customer: successState?.customerName || "",
                })}
          </p>

          <div className="mt-8 flex items-center justify-center">
            <Button size="sm" onClick={() => setSuccessOpen(false)}>
              {t("common.close")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function mapError(error: string, t: (key: string, values?: Record<string, string | number>) => string) {
  switch (error) {
    case "customer_required":
      return t("meters.transferErrorCustomerRequired");
    case "same_customer":
      return t("meters.transferErrorSameCustomer");
    case "customer_not_found":
      return t("meters.transferErrorCustomerNotFound");
    case "transfer_blocked_by_active_cycle":
      return t("meters.transferBlockedBody");
    case "meter_not_found":
      return t("meters.transferErrorMeterNotFound");
    default:
      return t("meters.transferErrorFailed");
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 19).replace("T", " ");
}
