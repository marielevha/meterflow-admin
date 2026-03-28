"use client";

import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminI18n } from "@/hooks/use-admin-i18n";

type SearchResource = "users" | "meters" | "readings" | "tasks" | "invoices";

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
    default:
      return resource;
  }
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
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const flattenedItems = useMemo(
    () => groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.resource }))),
    [groups],
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
        setGroups(data.groups || []);
        setActiveIndex(data.groups?.some((group) => group.items.length > 0) ? 0 : -1);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
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
      navigateTo(flattenedItems[activeIndex].href);
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
        <div className="absolute left-0 top-full z-[100000] mt-3 w-[min(100vw-2rem,32rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">{t("layout.searchTitle")}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("layout.searchHelp")}</p>
          </div>

          <div id="admin-global-search-results" role="listbox" className="max-h-[28rem] overflow-y-auto p-2">
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
            ) : groups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                {t("layout.searchNoResults")}
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => (
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
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setActiveIndex(itemIndex)}
                            onClick={() => navigateTo(item.href)}
                            className={`w-full rounded-xl px-3 py-2 text-left transition ${
                              isActive
                                ? "bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30"
                                : "hover:bg-gray-50 dark:hover:bg-white/[0.04]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">
                                  {item.title}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                                  {item.subtitle}
                                </p>
                              </div>
                              {item.meta ? (
                                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
                                  {item.meta}
                                </span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
