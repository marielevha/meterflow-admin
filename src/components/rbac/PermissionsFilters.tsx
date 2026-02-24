"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CloseLineIcon } from "@/icons";

type PermissionsFiltersProps = {
  initialPermQ: string;
  initialPermRole: string;
  initialPermResource: string;
  initialPermPageSize: number;
  rolesQ: string;
  rolesPageSize: number;
  rolesPage: number;
  roleOptions: string[];
  resourceOptions: string[];
  pageSizeOptions: number[];
};

export default function PermissionsFilters({
  initialPermQ,
  initialPermRole,
  initialPermResource,
  initialPermPageSize,
  rolesQ,
  rolesPageSize,
  rolesPage,
  roleOptions,
  resourceOptions,
  pageSizeOptions,
}: PermissionsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [permQ, setPermQ] = useState(initialPermQ);
  const [permRole, setPermRole] = useState(initialPermRole);
  const [permResource, setPermResource] = useState(initialPermResource);
  const [permPageSize, setPermPageSize] = useState(String(initialPermPageSize));
  const isFirstRender = useRef(true);

  const pushFilters = (overrides?: {
    permQ?: string;
    permRole?: string;
    permResource?: string;
    permPageSize?: string;
    permPage?: number;
  }) => {
    const params = new URLSearchParams();

    if (rolesQ) params.set("rolesQ", rolesQ);
    params.set("rolesPageSize", String(rolesPageSize));
    if (rolesPage > 1) params.set("rolesPage", String(rolesPage));

    const nextPermQ = overrides?.permQ ?? permQ;
    const nextPermRole = overrides?.permRole ?? permRole;
    const nextPermResource = overrides?.permResource ?? permResource;
    const nextPermPageSize = overrides?.permPageSize ?? permPageSize;
    const nextPermPage = overrides?.permPage ?? 1;

    if (nextPermQ.trim()) params.set("permQ", nextPermQ.trim());
    if (nextPermRole) params.set("permRole", nextPermRole);
    if (nextPermResource) params.set("permResource", nextPermResource);
    params.set("permPageSize", String(nextPermPageSize));
    if (nextPermPage > 1) params.set("permPage", String(nextPermPage));

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      pushFilters({ permQ, permPage: 1 });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [permQ]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <input
          type="text"
          value={permQ}
          onChange={(event) => setPermQ(event.target.value)}
          placeholder="Search permission by code/name/resource/action"
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        />
      </div>
      <div className="lg:col-span-2">
        <select
          value={permRole}
          onChange={(event) => {
            const value = event.target.value;
            setPermRole(value);
            pushFilters({ permRole: value, permPage: 1 });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          <option value="">All roles</option>
          {roleOptions.map((roleCode) => (
            <option key={roleCode} value={roleCode}>
              {roleCode}
            </option>
          ))}
        </select>
      </div>
      <div className="lg:col-span-2">
        <select
          value={permResource}
          onChange={(event) => {
            const value = event.target.value;
            setPermResource(value);
            pushFilters({ permResource: value, permPage: 1 });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          <option value="">All resources</option>
          {resourceOptions.map((resource) => (
            <option key={resource} value={resource}>
              {resource}
            </option>
          ))}
        </select>
      </div>
      <div className="lg:col-span-2">
        <select
          value={permPageSize}
          onChange={(event) => {
            const value = event.target.value;
            setPermPageSize(value);
            pushFilters({ permPageSize: value, permPage: 1 });
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
          onClick={() => {
            const defaultSize = String(pageSizeOptions[0] ?? 10);
            setPermQ("");
            setPermRole("");
            setPermResource("");
            setPermPageSize(defaultSize);
            pushFilters({
              permQ: "",
              permRole: "",
              permResource: "",
              permPageSize: defaultSize,
              permPage: 1,
            });
          }}
          title="Reset permissions filters"
          aria-label="Reset permissions filters"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
        >
          <CloseLineIcon />
        </button>
      </div>
    </div>
  );
}
