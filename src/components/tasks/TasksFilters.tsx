"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type TasksFiltersProps = {
  initialQ: string;
  initialStatus: string;
  initialPriority: string;
  initialType: string;
  initialAssignedToId: string;
  initialAssignmentState: string;
  initialDueState: string;
  initialReportState: string;
  initialPageSize: number;
  statusOptions: string[];
  priorityOptions: string[];
  typeOptions: string[];
  assigneeOptions: Array<{ id: string; label: string }>;
  pageSizeOptions: number[];
};

export default function TasksFilters({
  initialQ,
  initialStatus,
  initialPriority,
  initialType,
  initialAssignedToId,
  initialAssignmentState,
  initialDueState,
  initialReportState,
  initialPageSize,
  statusOptions,
  priorityOptions,
  typeOptions,
  assigneeOptions,
  pageSizeOptions,
}: TasksFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);
  const [priority, setPriority] = useState(initialPriority);
  const [type, setType] = useState(initialType);
  const [assignedToId, setAssignedToId] = useState(initialAssignedToId);
  const [assignmentState, setAssignmentState] = useState(initialAssignmentState);
  const [dueState, setDueState] = useState(initialDueState);
  const [reportState, setReportState] = useState(initialReportState);
  const [pageSize, setPageSize] = useState(String(initialPageSize));

  const isFirstRender = useRef(true);

  const pushFilters = (overrides?: {
    q?: string;
    status?: string;
    priority?: string;
    type?: string;
    assignedToId?: string;
    assignmentState?: string;
    dueState?: string;
    reportState?: string;
    pageSize?: string;
    keepPage?: boolean;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    const nextQ = overrides?.q ?? q;
    const nextStatus = overrides?.status ?? status;
    const nextPriority = overrides?.priority ?? priority;
    const nextType = overrides?.type ?? type;
    const nextAssignedToId = overrides?.assignedToId ?? assignedToId;
    const nextAssignmentState = overrides?.assignmentState ?? assignmentState;
    const nextDueState = overrides?.dueState ?? dueState;
    const nextReportState = overrides?.reportState ?? reportState;
    const nextPageSize = overrides?.pageSize ?? pageSize;
    const keepPage = overrides?.keepPage ?? false;

    if (nextQ.trim()) params.set("q", nextQ.trim());
    else params.delete("q");

    if (nextStatus) params.set("status", nextStatus);
    else params.delete("status");

    if (nextPriority) params.set("priority", nextPriority);
    else params.delete("priority");

    if (nextType) params.set("type", nextType);
    else params.delete("type");

    if (nextAssignedToId) params.set("assignedToId", nextAssignedToId);
    else params.delete("assignedToId");

    if (nextAssignmentState) params.set("assignmentState", nextAssignmentState);
    else params.delete("assignmentState");

    if (nextDueState) params.set("dueState", nextDueState);
    else params.delete("dueState");

    if (nextReportState) params.set("reportState", nextReportState);
    else params.delete("reportState");

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
          placeholder="Search by title, meter serial, reference"
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
          value={priority}
          onChange={(event) => {
            const value = event.target.value;
            setPriority(value);
            pushFilters({ priority: value, keepPage: false });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          <option value="">All priorities</option>
          {priorityOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="lg:col-span-2">
        <select
          value={type}
          onChange={(event) => {
            const value = event.target.value;
            setType(value);
            pushFilters({ type: value, keepPage: false });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          <option value="">All types</option>
          {typeOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="lg:col-span-2">
        <select
          value={assignedToId}
          onChange={(event) => {
            const value = event.target.value;
            setAssignedToId(value);
            pushFilters({ assignedToId: value, keepPage: false });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          <option value="">All assignees</option>
          {assigneeOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="lg:col-span-1" />

      <div className="lg:col-span-3">
        <select
          value={assignmentState}
          onChange={(event) => {
            const value = event.target.value;
            setAssignmentState(value);
            pushFilters({ assignmentState: value, keepPage: false });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          <option value="">All assignments</option>
          <option value="assigned">Assigned only</option>
          <option value="unassigned">Unassigned only</option>
        </select>
      </div>

      <div className="lg:col-span-3">
        <select
          value={dueState}
          onChange={(event) => {
            const value = event.target.value;
            setDueState(value);
            pushFilters({ dueState: value, keepPage: false });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          <option value="">All due dates</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="upcoming">Upcoming</option>
        </select>
      </div>

      <div className="lg:col-span-3">
        <select
          value={reportState}
          onChange={(event) => {
            const value = event.target.value;
            setReportState(value);
            pushFilters({ reportState: value, keepPage: false });
          }}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          <option value="">All field reports</option>
          <option value="with_report">With report</option>
          <option value="without_report">Without report</option>
        </select>
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
              {option} / page
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
            setPriority("");
            setType("");
            setAssignedToId("");
            setAssignmentState("");
            setDueState("");
            setReportState("");
            setPageSize(String(pageSizeOptions[0] ?? 10));
            router.replace(pathname, { scroll: false });
          }}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
          aria-label="Reset filters"
          title="Reset filters"
        >
          ↺
        </button>
      </div>
    </div>
  );
}
