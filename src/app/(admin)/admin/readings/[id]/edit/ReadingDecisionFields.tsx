"use client";

import { useMemo, useState } from "react";
import { ReadingStatus } from "@prisma/client";
import Label from "@/components/form/Label";
import { useAdminI18n } from "@/hooks/use-admin-i18n";
import { translateReadingStatus } from "@/lib/admin-i18n/labels";

type ReasonOption = {
  code: string;
  label: string;
};

type Props = {
  allowedStatuses: ReadingStatus[];
  defaultStatus: ReadingStatus;
  defaultFlagReason: string;
  defaultRejectionReason: string;
  flagOptions: ReasonOption[];
  rejectionOptions: ReasonOption[];
};

export default function ReadingDecisionFields({
  allowedStatuses,
  defaultStatus,
  defaultFlagReason,
  defaultRejectionReason,
  flagOptions,
  rejectionOptions,
}: Props) {
  const [status, setStatus] = useState<ReadingStatus>(defaultStatus);
  const { t } = useAdminI18n();

  const statusOptions = useMemo(
    () => Array.from(new Set(allowedStatuses)),
    [allowedStatuses]
  );

  const isFlagged = status === ReadingStatus.FLAGGED;
  const isRejected = status === ReadingStatus.REJECTED;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="status">{t("readings.decisionStatus")}</Label>
        <select
          id="status"
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value as ReadingStatus)}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {translateReadingStatus(option, t)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="flagReason">{t("readings.flagReason")}</Label>
          <select
            id="flagReason"
            name="flagReason"
            defaultValue={defaultFlagReason}
            required={isFlagged}
            disabled={!isFlagged}
            className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          >
            <option value="">{t("readings.selectFlagReason")}</option>
            {flagOptions.map((reason) => (
              <option key={reason.code} value={reason.code}>
                {reason.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {isFlagged ? t("readings.flagReasonRequired") : t("readings.flagReasonOnly")}
          </p>
        </div>

        <div>
          <Label htmlFor="rejectionReason">{t("readings.rejectionReason")}</Label>
          <select
            id="rejectionReason"
            name="rejectionReason"
            defaultValue={defaultRejectionReason}
            required={isRejected}
            disabled={!isRejected}
            className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          >
            <option value="">{t("readings.selectRejectionReason")}</option>
            {rejectionOptions.map((reason) => (
              <option key={reason.code} value={reason.code}>
                {reason.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {isRejected ? t("readings.rejectionReasonRequired") : t("readings.rejectionReasonOnly")}
          </p>
        </div>
      </div>
    </div>
  );
}
