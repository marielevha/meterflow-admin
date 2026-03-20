"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CloseLineIcon } from "@/icons";
import { useAdminI18n } from "@/hooks/use-admin-i18n";

type RolesFiltersProps = {
  initialRolesQ: string;
  initialRolesPageSize: number;
  permQ: string;
  permRole: string;
  permResource: string;
  permPageSize: number;
  permPage: number;
  pageSizeOptions: number[];
};

export default function RolesFilters({
  initialRolesQ,
  initialRolesPageSize,
  permQ,
  permRole,
  permResource,
  permPageSize,
  permPage,
  pageSizeOptions,
}: RolesFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useAdminI18n();

  const [rolesQ, setRolesQ] = useState(initialRolesQ);
  const [rolesPageSize, setRolesPageSize] = useState(String(initialRolesPageSize));
  const isFirstRender = useRef(true);

  const pushFilters = (overrides?: {
    rolesQ?: string;
    rolesPageSize?: string;
    rolesPage?: number;
  }) => {
    const params = new URLSearchParams();

    const nextRolesQ = overrides?.rolesQ ?? rolesQ;
    const nextRolesPageSize = overrides?.rolesPageSize ?? rolesPageSize;
    const nextRolesPage = overrides?.rolesPage ?? 1;

    if (nextRolesQ.trim()) params.set("rolesQ", nextRolesQ.trim());
    params.set("rolesPageSize", String(nextRolesPageSize));
    if (nextRolesPage > 1) params.set("rolesPage", String(nextRolesPage));

    if (permQ) params.set("permQ", permQ);
    if (permRole) params.set("permRole", permRole);
    if (permResource) params.set("permResource", permResource);
    params.set("permPageSize", String(permPageSize));
    if (permPage > 1) params.set("permPage", String(permPage));

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      pushFilters({ rolesQ, rolesPage: 1 });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [rolesQ]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <input
          type="text"
          value={rolesQ}
          onChange={(event) => setRolesQ(event.target.value)}
          placeholder={t("roleFilters.searchPlaceholder")}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        />
      </div>
      <div className="lg:col-span-3">
        <select
          value={rolesPageSize}
          onChange={(event) => {
            const value = event.target.value;
            setRolesPageSize(value);
            pushFilters({ rolesPageSize: value, rolesPage: 1 });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} {t("roleFilters.pageSizeSuffix")}
            </option>
          ))}
        </select>
      </div>
      <div className="lg:col-span-1 flex justify-end">
        <button
          type="button"
          onClick={() => {
            const defaultSize = String(pageSizeOptions[0] ?? 5);
            setRolesQ("");
            setRolesPageSize(defaultSize);
            pushFilters({ rolesQ: "", rolesPageSize: defaultSize, rolesPage: 1 });
          }}
          title={t("roleFilters.reset")}
          aria-label={t("roleFilters.reset")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
        >
          <CloseLineIcon />
        </button>
      </div>
    </div>
  );
}
