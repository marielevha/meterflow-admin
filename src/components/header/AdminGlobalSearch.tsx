"use client";

import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminI18n } from "@/hooks/use-admin-i18n";
import { buildHighlightParts } from "@/lib/search/globalSearchUtils";

type SearchResource =
  | "users"
  | "meters"
  | "readings"
  | "tasks"
  | "invoices"
  | "campaigns"
  | "tariffs"
  | "zones"
  | "cities"
  | "roles";

type SearchItem = {
  id: string;
  resource: SearchResource;
  title: string;
  subtitle: string;
  meta?: string;
  href: string;
};

type SearchGroup = {
  resource: SearchResource;
  items: SearchItem[];
};

type SearchResponse = {
  query: string;
  topResults: SearchItem[];
  groups: SearchGroup[];
};

const MIN_SEARCH_LENGTH = 2;

function resourceLabel(resource: SearchResource, t: (key: string, values?: Record<string, string | number>) => string) {
  switch (resource) {
    case "users":
      return t("nav.users");
    case "meters":
      return t("nav.meters");
    case "readings":
      return t("nav.readings");
    case "tasks":
      return t("nav.tasks");
    case "invoices":
      return t("nav.invoices");
    case "campaigns":
      return t("billing.campaignsPageTitle");
    case "tariffs":
      return t("billing.tariffsPageTitle");
    case "zones":
      return t("billing.zonesPageTitle");
    case "cities":
      return t("billing.citiesPageTitle");
    case "roles":
      return t("rbac.rolesTitle");
    default:
      return resource;
  }
}

function resourceBadgeClasses(resource: SearchResource) {
  switch (resource) {
    case "users":
      return "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/30";
    case "meters":
      return "bg-success-50 text-success-700 ring-success-200 dark:bg-success-500/10 dark:text-success-200 dark:ring-success-500/30";
    case "readings":
      return "bg-warning-50 text-warning-700 ring-warning-200 dark:bg-warning-500/10 dark:text-warning-100 dark:ring-warning-500/30";
    case "tasks":
      return "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-200 dark:ring-indigo-500/30";
    case "invoices":
      return "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/30";
    case "campaigns":
      return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30";
    case "tariffs":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30";
    case "zones":
      return "bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-200 dark:ring-cyan-500/30";
    case "cities":
      return "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-500/30";
    case "roles":
      return "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30";
    default:
      return "bg-gray-100 text-gray-700 ring-gray-200 dark:bg-white/[0.06] dark:text-gray-200 dark:ring-white/10";
  }
}

function HighlightedText({
  value,
  query,
  className,
}: {
  value: string;
  query: string;
  className?: string;
}) {
  const parts = useMemo(() => buildHighlightParts(value, query), [value, query]);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.match ? (
          <mark
            key={`${part.text}-${index}`}
            className="rounded bg-brand-100 px-0.5 text-inherit dark:bg-brand-500/20"
          >
            {part.text}
          </mark>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        ),
      )}
    </span>
  );
}

function ResultCard({
  item,
  query,
  isActive,
  badge,
  openInNewTabLabel,
  onHover,
  onSelect,
  onOpenInNewTab,
}: {
  item: SearchItem;
  query: string;
  isActive: boolean;
  badge: ReactNode;
  openInNewTabLabel: string;
  onHover: () => void;
  onSelect: () => void;
  onOpenInNewTab: () => void;
}) {
  return (
    <div
      className={`group relative rounded-xl transition ${
        isActive
          ? "bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30"
          : "hover:bg-gray-50 dark:hover:bg-white/[0.04]"
      }`}
      onMouseEnter={onHover}
    >
      <button
        type="button"
        role="option"
        aria-selected={isActive}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onSelect}
        className="w-full rounded-xl px-3 py-3 text-left"
      >
        <div className="flex items-start justify-between gap-3 pr-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {badge}
              <HighlightedText
                value={item.title}
                query={query}
                className="truncate text-sm font-medium text-gray-800 dark:text-white/90"
              />
            </div>
            <HighlightedText
              value={item.subtitle}
              query={query}
              className="mt-1 block truncate text-xs text-gray-500 dark:text-gray-400"
            />
          </div>
          {item.meta ? (
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
              {item.meta}
            </span>
          ) : null}
        </div>
      </button>

      <button
        type="button"
        title={openInNewTabLabel}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onOpenInNewTab}
        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-gray-400 opacity-0 transition hover:border-gray-200 hover:bg-white hover:text-gray-700 group-hover:opacity-100 dark:hover:border-gray-700 dark:hover:bg-gray-900 dark:hover:text-white/90"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M9.33301 2.66699H13.333V6.66699M7.33301 8.66699L13.0663 2.93366M6.66634 3.33366H4.53301C3.78627 3.33366 3.41357 3.33366 3.12836 3.47899C2.87748 3.60682 2.6735 3.8108 2.54567 4.06168C2.40034 4.34689 2.40034 4.71959 2.40034 5.46633V11.4663C2.40034 12.2131 2.40034 12.5858 2.54567 12.871C2.6735 13.1218 2.87748 13.3258 3.12836 13.4537C3.41357 13.599 3.78627 13.599 4.53301 13.599H10.533C11.2797 13.599 11.6524 13.599 11.9377 13.4537C12.1885 13.3258 12.3925 13.1218 12.5203 12.871C12.6657 12.5858 12.6657 12.2131 12.6657 11.4663V9.33366"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

export default function AdminGlobalSearch() {
  const { t } = useAdminI18n();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [topResults, setTopResults] = useState<SearchItem[]>([]);
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const dedupedGroupItems = useMemo(() => {
    const highlightedIds = new Set(topResults.map((item) => `${item.resource}:${item.id}`));

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !highlightedIds.has(`${item.resource}:${item.id}`)),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, topResults]);

  const flattenedItems = useMemo(
    () => [
      ...topResults.map((item) => ({ ...item, group: "topResults" as const })),
      ...dedupedGroupItems.flatMap((group) => group.items.map((item) => ({ ...item, group: group.resource }))),
    ],
    [dedupedGroupItems, topResults],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < MIN_SEARCH_LENGTH) {
      setTopResults([]);
      setGroups([]);
      setError("");
      setIsLoading(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        setError("");

        const response = await fetch(`/api/v1/search/global?q=${encodeURIComponent(trimmedQuery)}`, {
          method: "GET",
          credentials: "same-origin",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`search_failed_${response.status}`);
        }

        const data = (await response.json()) as SearchResponse;
        const nextTopResults = data.topResults || [];
        const nextGroups = data.groups || [];
        setTopResults(nextTopResults);
        setGroups(nextGroups);
        setActiveIndex(nextTopResults.length || nextGroups.some((group) => group.items.length > 0) ? 0 : -1);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setTopResults([]);
        setGroups([]);
        setActiveIndex(-1);
        setError(fetchError instanceof Error ? fetchError.message : "search_failed");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, query]);

  function closeSearch() {
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function navigateTo(href: string) {
    closeSearch();
    router.push(href);
  }

  function openInNewTab(href: string) {
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      inputRef.current?.blur();
      return;
    }

    if (!flattenedItems.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % flattenedItems.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? flattenedItems.length - 1 : current - 1));
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const activeItem = flattenedItems[activeIndex];
      if (event.metaKey || event.ctrlKey) {
        openInNewTab(activeItem.href);
        return;
      }
      navigateTo(activeItem.href);
    }
  }

  let renderIndex = -1;

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
          <svg
            className="fill-gray-500 dark:fill-gray-400"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <input
          ref={inputRef}
          role="combobox"
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder={t("layout.searchPlaceholder")}
          className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-14 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 xl:w-[430px]"
          aria-label={t("layout.searchPlaceholder")}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls="admin-global-search-results"
        />

        <button
          type="button"
          title={t("layout.searchShortcutHint")}
          onClick={() => {
            setIsOpen(true);
            inputRef.current?.focus();
            inputRef.current?.select();
          }}
          className="absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-[7px] py-[4.5px] text-xs -tracking-[0.2px] text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400"
        >
          <span>⌘</span>
          <span>K</span>
        </button>
      </div>

      {isOpen ? (
        <div className="absolute left-0 top-full z-[100000] mt-3 w-[min(100vw-2rem,38rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">{t("layout.searchTitle")}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("layout.searchHelp")}</p>
          </div>

          <div id="admin-global-search-results" role="listbox" className="max-h-[32rem] overflow-y-auto p-2">
            {query.trim().length < MIN_SEARCH_LENGTH ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                {t("layout.searchMinChars", { count: MIN_SEARCH_LENGTH })}
              </div>
            ) : isLoading ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                {t("layout.searchLoading")}
              </div>
            ) : error ? (
              <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-5 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
                {t("layout.searchError")}
              </div>
            ) : topResults.length === 0 && groups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                {t("layout.searchNoResults")}
              </div>
            ) : (
              <div className="space-y-4">
                {topResults.length > 0 ? (
                  <section>
                    <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {t("layout.searchTopResults")}
                    </p>
                    <div className="space-y-1">
                      {topResults.map((item) => {
                        renderIndex += 1;
                        const itemIndex = renderIndex;
                        const isActive = itemIndex === activeIndex;

                        return (
                          <ResultCard
                            key={`top-${item.id}`}
                            item={item}
                            query={query}
                            isActive={isActive}
                            badge={
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${resourceBadgeClasses(item.resource)}`}
                              >
                                {resourceLabel(item.resource, t)}
                              </span>
                            }
                            openInNewTabLabel={t("layout.searchOpenInNewTab")}
                            onHover={() => setActiveIndex(itemIndex)}
                            onSelect={() => navigateTo(item.href)}
                            onOpenInNewTab={() => openInNewTab(item.href)}
                          />
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {dedupedGroupItems.map((group) => (
                  <section key={group.resource}>
                    <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {resourceLabel(group.resource, t)}
                    </p>
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        renderIndex += 1;
                        const itemIndex = renderIndex;
                        const isActive = itemIndex === activeIndex;

                        return (
                          <ResultCard
                            key={item.id}
                            item={item}
                            query={query}
                            isActive={isActive}
                            badge={
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${resourceBadgeClasses(item.resource)}`}
                              >
                                {resourceLabel(item.resource, t)}
                              </span>
                            }
                            openInNewTabLabel={t("layout.searchOpenInNewTab")}
                            onHover={() => setActiveIndex(itemIndex)}
                            onSelect={() => navigateTo(item.href)}
                            onOpenInNewTab={() => openInNewTab(item.href)}
                          />
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <span>{t("layout.searchKeyboardHelp")}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
