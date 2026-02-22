"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CloseLineIcon } from "@/icons";

type MeterStatesFiltersProps = {
  initialMsQ: string;
  initialMsHasSource: string;
  initialMsPageSize: number;
  evQ: string;
  evType: string;
  evPageSize: number;
  evPage: number;
  pageSizeOptions: number[];
};

export default function MeterStatesFilters({
  initialMsQ,
  initialMsHasSource,
  initialMsPageSize,
  evQ,
  evType,
  evPageSize,
  evPage,
  pageSizeOptions,
}: MeterStatesFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  const [msQ, setMsQ] = useState(initialMsQ);
  const [msHasSource, setMsHasSource] = useState(initialMsHasSource);
  const [msPageSize, setMsPageSize] = useState(String(initialMsPageSize));

  const pushFilters = (overrides?: {
    msQ?: string;
    msHasSource?: string;
    msPageSize?: string;
    msPage?: number;
  }) => {
    const params = new URLSearchParams();
    const nextMsQ = overrides?.msQ ?? msQ;
    const nextMsHasSource = overrides?.msHasSource ?? msHasSource;
    const nextMsPageSize = overrides?.msPageSize ?? msPageSize;
    const nextMsPage = overrides?.msPage ?? 1;

    if (nextMsQ.trim()) params.set("msQ", nextMsQ.trim());
    if (nextMsHasSource) params.set("msHasSource", nextMsHasSource);
    params.set("msPageSize", String(nextMsPageSize));
    if (nextMsPage > 1) params.set("msPage", String(nextMsPage));

    if (evQ) params.set("evQ", evQ);
    if (evType) params.set("evType", evType);
    params.set("evPageSize", String(evPageSize));
    if (evPage > 1) params.set("evPage", String(evPage));

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      pushFilters({ msQ, msPage: 1 });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [msQ]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <input
          type="text"
          value={msQ}
          onChange={(event) => setMsQ(event.target.value)}
          placeholder="Search by meter serial"
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        />
      </div>

      <div className="lg:col-span-2">
        <select
          value={msHasSource}
          onChange={(event) => {
            const value = event.target.value;
            setMsHasSource(value);
            pushFilters({ msHasSource: value, msPage: 1 });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          <option value="">All sources</option>
          <option value="with">With source reading</option>
          <option value="without">Without source reading</option>
        </select>
      </div>

      <div className="lg:col-span-2">
        <select
          value={msPageSize}
          onChange={(event) => {
            const value = event.target.value;
            setMsPageSize(value);
            pushFilters({ msPageSize: value, msPage: 1 });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
      </div>

      <div className="lg:col-span-1 flex justify-end">
        <button
          type="button"
          title="Reset meter states filters"
          aria-label="Reset meter states filters"
          onClick={() => {
            const defaultSize = String(pageSizeOptions[0] ?? 10);
            setMsQ("");
            setMsHasSource("");
            setMsPageSize(defaultSize);
            pushFilters({
              msQ: "",
              msHasSource: "",
              msPageSize: defaultSize,
              msPage: 1,
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
