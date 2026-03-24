"use client";

import { useState } from "react";
import { useAdminI18n } from "@/hooks/use-admin-i18n";
import Button from "@/components/ui/button/Button";

type BillingCreatePanelProps = {
  defaultOpen?: boolean;
  title: string;
  openDescription: string;
  closedDescription: string;
  openLabel: string;
  closeLabel: string;
  visibleBadgeLabel?: string;
  hiddenBadgeLabel?: string;
  children: React.ReactNode;
};

export default function BillingCreatePanel({
  defaultOpen = false,
  title,
  openDescription,
  closedDescription,
  openLabel,
  closeLabel,
  visibleBadgeLabel,
  hiddenBadgeLabel,
  children,
}: BillingCreatePanelProps) {
  const { t } = useAdminI18n();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-5 dark:border-gray-700 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">{title}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {isOpen ? openDescription : closedDescription}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {isOpen ? (
              <span className="rounded-full bg-success-50 px-3 py-1 text-xs font-medium text-success-700 dark:bg-success-500/10 dark:text-success-300">
                {visibleBadgeLabel || t("billing.createPanelVisible")}
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-white/[0.05] dark:text-gray-300">
                {hiddenBadgeLabel || t("billing.createPanelHidden")}
              </span>
            )}

            <Button
              size="sm"
              variant={isOpen ? "outline" : "primary"}
              onClick={() => setIsOpen((current) => !current)}
            >
              {isOpen ? closeLabel : openLabel}
            </Button>
          </div>
        </div>
      </div>

      {isOpen ? children : null}
    </div>
  );
}
