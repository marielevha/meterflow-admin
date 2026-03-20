"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminI18n } from "@/hooks/use-admin-i18n";

type ReadingsFiltersProps = {
  initialQ: string;
  initialStatus: string;
  initialDateFrom: string;
  initialDateTo: string;
  initialPageSize: number;
  statusOptions: string[];
  pageSizeOptions: number[];
};

export default function ReadingsFilters({
  initialQ,
  initialStatus,
  initialDateFrom,
  initialDateTo,
  initialPageSize,
  statusOptions,
  pageSizeOptions,
}: ReadingsFiltersProps) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [pageSize, setPageSize] = useState(String(initialPageSize));

  const isFirstRender = useRef(true);

  const pushFilters = (overrides?: {
    q?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    pageSize?: string;
    keepPage?: boolean;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    const nextQ = overrides?.q ?? q;
    const nextStatus = overrides?.status ?? status;
    const nextDateFrom = overrides?.dateFrom ?? dateFrom;
    const nextDateTo = overrides?.dateTo ?? dateTo;
    const nextPageSize = overrides?.pageSize ?? pageSize;
    const keepPage = overrides?.keepPage ?? false;

    if (nextQ.trim()) params.set("q", nextQ.trim());
    else params.delete("q");

    if (nextStatus) params.set("status", nextStatus);
    else params.delete("status");

    if (nextDateFrom) params.set("dateFrom", nextDateFrom);
    else params.delete("dateFrom");

    if (nextDateTo) params.set("dateTo", nextDateTo);
    else params.delete("dateTo");

    if (nextPageSize) params.set("pageSize", nextPageSize);
    else params.delete("pageSize");

    if (!keepPage) params.delete("page");

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      pushFilters({ q, keepPage: false });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <input
          type="text"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={t("readingFilters.searchPlaceholder")}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        />
      </div>

      <div className="lg:col-span-2">
        <select
          value={status}
          onChange={(event) => {
            const value = event.target.value;
            setStatus(value);
            pushFilters({ status: value, keepPage: false });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          <option value="">{t("readingFilters.allStatuses")}</option>
          {statusOptions.map((item) => (
            <option key={item} value={item}>
              {item === "PENDING"
                ? t("overview.pending")
                : item === "VALIDATED"
                  ? t("overview.validated")
                  : item === "FLAGGED"
                    ? t("overview.flagged")
                    : item === "REJECTED"
                      ? t("overview.rejected")
                      : item}
            </option>
          ))}
        </select>
      </div>

      <div className="lg:col-span-2">
        <input
          type="date"
          value={dateFrom}
          onChange={(event) => {
            const value = event.target.value;
            setDateFrom(value);
            pushFilters({ dateFrom: value, keepPage: false });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        />
      </div>

      <div className="lg:col-span-2">
        <input
          type="date"
          value={dateTo}
          onChange={(event) => {
            const value = event.target.value;
            setDateTo(value);
            pushFilters({ dateTo: value, keepPage: false });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        />
      </div>

      <div className="lg:col-span-1">
        <select
          value={pageSize}
          onChange={(event) => {
            const value = event.target.value;
            setPageSize(value);
            pushFilters({ pageSize: value, keepPage: false });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option} {t("readingFilters.pageSizeSuffix")}
            </option>
          ))}
        </select>
      </div>

      <div className="lg:col-span-1 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setQ("");
            setStatus("");
            setDateFrom("");
            setDateTo("");
            setPageSize(String(pageSizeOptions[0] ?? 10));
            router.replace(pathname, { scroll: false });
          }}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
          aria-label={t("readingFilters.reset")}
          title={t("readingFilters.reset")}
        >
          ↺
        </button>
      </div>
    </div>
  );
}
