"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAdminI18n } from "@/hooks/use-admin-i18n";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { toggleTariffPlanInlineAction } from "@/app/(admin)/admin/billing/actions";

type TariffPlanStatusSwitchProps = {
  planId: string;
  planCode: string;
  initialChecked: boolean;
};

export default function TariffPlanStatusSwitch({
  planId,
  planCode,
  initialChecked,
}: TariffPlanStatusSwitchProps) {
  const router = useRouter();
  const { t } = useAdminI18n();
  const [isChecked, setIsChecked] = useState(initialChecked);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingValue, setPendingValue] = useState(initialChecked);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setIsChecked(initialChecked);
  }, [initialChecked]);

  const confirmTitle = useMemo(
    () => (pendingValue ? t("billing.enableTariffQuestion") : t("billing.disableTariffQuestion")),
    [pendingValue, t]
  );

  const successTitle = useMemo(
    () => (isChecked ? t("billing.tariffEnabled") : t("billing.tariffDisabled")),
    [isChecked, t]
  );

  const openConfirmation = () => {
    if (isPending) return;
    setError(null);
    setPendingValue(!isChecked);
    setConfirmOpen(true);
  };

  const closeConfirmation = () => {
    if (isPending) return;
    setConfirmOpen(false);
    setError(null);
  };

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await toggleTariffPlanInlineAction(planId, pendingValue);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setIsChecked(pendingValue);
      setConfirmOpen(false);
      setSuccessOpen(true);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openConfirmation}
        disabled={isPending}
        className="inline-flex items-center disabled:cursor-not-allowed disabled:opacity-60"
        aria-pressed={isChecked}
        aria-label={isChecked ? t("billing.disableTariffQuestion") : t("billing.enableTariffQuestion")}
        title={isChecked ? t("billing.disableTariffQuestion") : t("billing.enableTariffQuestion")}
      >
        <span
          className={`relative block h-6 w-11 rounded-full transition ${
            isChecked ? "bg-brand-500" : "bg-gray-200 dark:bg-white/10"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-theme-sm transition ${
              isChecked ? "translate-x-full" : "translate-x-0"
            }`}
          />
        </span>
      </button>

      <Modal
        isOpen={confirmOpen}
        onClose={closeConfirmation}
        showCloseButton={!isPending}
        className="max-w-[480px] p-6 lg:p-8"
      >
        <div className="space-y-6">
          <div>
            <h4 className="text-xl font-semibold text-gray-800 dark:text-white/90">{confirmTitle}</h4>
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
              {pendingValue
                ? t("billing.enableTariffBody", { code: planCode })
                : t("billing.disableTariffBody", { code: planCode })}
            </p>
            {error ? (
              <div className="mt-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
                {t("common.error")}: {error}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button size="sm" variant="outline" onClick={closeConfirmation} disabled={isPending}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={isPending}>
              {isPending ? t("settingsForm.saving") : pendingValue ? t("billing.yesEnable") : t("billing.yesDisable")}
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
          <h4 className="mt-5 text-2xl font-semibold text-gray-800 dark:text-white/90">{successTitle}</h4>
          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {t("billing.updatedSuccessfully", { code: planCode })}
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
