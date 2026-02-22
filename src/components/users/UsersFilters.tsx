"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type UsersFiltersProps = {
  initialQ: string;
  initialRole: string;
  initialStatus: string;
  initialPageSize: number;
  roleOptions: string[];
  statusOptions: string[];
  pageSizeOptions: number[];
};

export default function UsersFilters({
  initialQ,
  initialRole,
  initialStatus,
  initialPageSize,
  roleOptions,
  statusOptions,
  pageSizeOptions,
}: UsersFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(initialQ);
  const [role, setRole] = useState(initialRole);
  const [status, setStatus] = useState(initialStatus);
  const [pageSize, setPageSize] = useState(String(initialPageSize));

  const isFirstRender = useRef(true);

  const pushFilters = (overrides?: {
    q?: string;
    role?: string;
    status?: string;
    pageSize?: string;
    keepPage?: boolean;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    const nextQ = overrides?.q ?? q;
    const nextRole = overrides?.role ?? role;
    const nextStatus = overrides?.status ?? status;
    const nextPageSize = overrides?.pageSize ?? pageSize;
    const keepPage = overrides?.keepPage ?? false;

    if (nextQ.trim()) params.set("q", nextQ.trim());
    else params.delete("q");

    if (nextRole) params.set("role", nextRole);
    else params.delete("role");

    if (nextStatus) params.set("status", nextStatus);
    else params.delete("status");

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
    }, 350);

    return () => window.clearTimeout(timer);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <input
          type="text"
          name="q"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search by name, username, email, phone"
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        />
      </div>

      <div className="lg:col-span-2">
        <select
          name="role"
          value={role}
          onChange={(event) => {
            const value = event.target.value;
            setRole(value);
            pushFilters({ role: value, keepPage: false });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          <option value="">All roles</option>
          {roleOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="lg:col-span-2">
        <select
          name="status"
          value={status}
          onChange={(event) => {
            const value = event.target.value;
            setStatus(value);
            pushFilters({ status: value, keepPage: false });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          <option value="">All statuses</option>
          {statusOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="lg:col-span-2">
        <select
          name="pageSize"
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
              {option} / page
            </option>
          ))}
        </select>
      </div>

      <div className="lg:col-span-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setQ("");
            setRole("");
            setStatus("");
            setPageSize(String(pageSizeOptions[0] ?? 10));
            router.replace(pathname, { scroll: false });
          }}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
