"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminI18n } from "@/hooks/use-admin-i18n";

type ConsumptionPerPageProps = {
  value: number;
  options: number[];
};

export default function ConsumptionPerPage({ value, options }: ConsumptionPerPageProps) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <select
      value={String(value)}
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("pageSize", event.target.value);
        params.delete("page");
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }}
      className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
      aria-label={t("consumption.rowsPerPage")}
    >
      {options.map((size) => (
        <option key={size} value={size}>
          {size} {t("history.pageSizeSuffix")}
        </option>
      ))}
    </select>
  );
}
