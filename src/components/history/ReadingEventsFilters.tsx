"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CloseLineIcon } from "@/icons";
import { translateReadingEventType } from "@/lib/admin-i18n/labels";
import { useAdminI18n } from "@/hooks/use-admin-i18n";

type ReadingEventsFiltersProps = {
  initialEvQ: string;
  initialEvType: string;
  initialEvPageSize: number;
  msQ: string;
  msHasSource: string;
  msPageSize: number;
  msPage: number;
  eventTypeOptions: string[];
  pageSizeOptions: number[];
};

export default function ReadingEventsFilters({
  initialEvQ,
  initialEvType,
  initialEvPageSize,
  msQ,
  msHasSource,
  msPageSize,
  msPage,
  eventTypeOptions,
  pageSizeOptions,
}: ReadingEventsFiltersProps) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  const [evQ, setEvQ] = useState(initialEvQ);
  const [evType, setEvType] = useState(initialEvType);
  const [evPageSize, setEvPageSize] = useState(String(initialEvPageSize));

  const pushFilters = (overrides?: {
    evQ?: string;
    evType?: string;
    evPageSize?: string;
    evPage?: number;
  }) => {
    const params = new URLSearchParams();

    if (msQ) params.set("msQ", msQ);
    if (msHasSource) params.set("msHasSource", msHasSource);
    params.set("msPageSize", String(msPageSize));
    if (msPage > 1) params.set("msPage", String(msPage));

    const nextEvQ = overrides?.evQ ?? evQ;
    const nextEvType = overrides?.evType ?? evType;
    const nextEvPageSize = overrides?.evPageSize ?? evPageSize;
    const nextEvPage = overrides?.evPage ?? 1;

    if (nextEvQ.trim()) params.set("evQ", nextEvQ.trim());
    if (nextEvType) params.set("evType", nextEvType);
    params.set("evPageSize", String(nextEvPageSize));
    if (nextEvPage > 1) params.set("evPage", String(nextEvPage));

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      pushFilters({ evQ, evPage: 1 });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [evQ]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <input
          type="text"
          value={evQ}
          onChange={(event) => setEvQ(event.target.value)}
          placeholder={t("history.searchEventPlaceholder")}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        />
      </div>

      <div className="lg:col-span-2">
        <select
          value={evType}
          onChange={(event) => {
            const value = event.target.value;
            setEvType(value);
            pushFilters({ evType: value, evPage: 1 });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          <option value="">{t("history.allEvents")}</option>
          {eventTypeOptions.map((eventType) => (
            <option key={eventType} value={eventType}>
              {translateReadingEventType(eventType, t)}
            </option>
          ))}
        </select>
      </div>

      <div className="lg:col-span-2">
        <select
          value={evPageSize}
          onChange={(event) => {
            const value = event.target.value;
            setEvPageSize(value);
            pushFilters({ evPageSize: value, evPage: 1 });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} {t("history.pageSizeSuffix")}
            </option>
          ))}
        </select>
      </div>

      <div className="lg:col-span-1 flex justify-end">
        <button
          type="button"
          title={t("history.resetEventFilters")}
          aria-label={t("history.resetEventFilters")}
          onClick={() => {
            const defaultSize = String(pageSizeOptions[0] ?? 10);
            setEvQ("");
            setEvType("");
            setEvPageSize(defaultSize);
            pushFilters({
              evQ: "",
              evType: "",
              evPageSize: defaultSize,
              evPage: 1,
            });
          }}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
        >
          <CloseLineIcon />
        </button>
      </div>
    </div>
  );
}
