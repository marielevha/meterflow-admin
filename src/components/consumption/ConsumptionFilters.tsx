"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminI18n } from "@/hooks/use-admin-i18n";

type ConsumptionFiltersProps = {
  initialQ: string;
  initialCity: string;
  initialZone: string;
  cityOptions: string[];
  zoneOptions: string[];
};

export default function ConsumptionFilters({
  initialQ,
  initialCity,
  initialZone,
  cityOptions,
  zoneOptions,
}: ConsumptionFiltersProps) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(initialQ);
  const [city, setCity] = useState(initialCity);
  const [zone, setZone] = useState(initialZone);
  const isFirstRender = useRef(true);

  const pushFilters = (overrides?: {
    q?: string;
    city?: string;
    zone?: string;
    keepPage?: boolean;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    const nextQ = overrides?.q ?? q;
    const nextCity = overrides?.city ?? city;
    const nextZone = overrides?.zone ?? zone;
    const keepPage = overrides?.keepPage ?? false;

    if (nextQ.trim()) params.set("q", nextQ.trim());
    else params.delete("q");

    if (nextCity) params.set("city", nextCity);
    else params.delete("city");

    if (nextZone) params.set("zone", nextZone);
    else params.delete("zone");

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
    }, 350);
    return () => window.clearTimeout(timer);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <input
          type="text"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={t("consumption.searchPlaceholder")}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        />
      </div>
      <div className="lg:col-span-2">
        <select
          value={city}
          onChange={(event) => {
            const value = event.target.value;
            setCity(value);
            pushFilters({ city: value, keepPage: false });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          <option value="">{t("consumption.allCities")}</option>
          {cityOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <div className="lg:col-span-2">
        <select
          value={zone}
          onChange={(event) => {
            const value = event.target.value;
            setZone(value);
            pushFilters({ zone: value, keepPage: false });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          <option value="">{t("consumption.allZones")}</option>
          {zoneOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <div className="lg:col-span-2">
        <button
          type="button"
          onClick={() => {
            setQ("");
            setCity("");
            setZone("");
            router.replace(pathname, { scroll: false });
          }}
          aria-label={t("consumption.resetFilters")}
          title={t("consumption.resetFilters")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 3v6h6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
