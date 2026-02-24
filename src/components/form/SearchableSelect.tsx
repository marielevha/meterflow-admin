"use client";

import { useMemo, useState } from "react";

type SearchableOption = {
  value: string;
  label: string;
  hint?: string;
};

type SearchableSelectProps = {
  id?: string;
  name: string;
  options: SearchableOption[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  emptyLabel?: string;
};

export default function SearchableSelect({
  id,
  name,
  options,
  defaultValue = "",
  placeholder = "Search...",
  required = false,
  emptyLabel,
}: SearchableSelectProps) {
  const formatDisplay = (option: SearchableOption) =>
    option.hint ? `${option.label} - ${option.hint}` : option.label;

  const initial = options.find((option) => option.value === defaultValue);
  const [selectedValue, setSelectedValue] = useState(defaultValue);
  const [query, setQuery] = useState(initial ? formatDisplay(initial) : "");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const base = !term
      ? options
      : options.filter((option) =>
          `${option.label} ${option.hint ?? ""}`.toLowerCase().includes(term),
        );

    if (emptyLabel) {
      return [{ value: "", label: emptyLabel }, ...base];
    }

    return base;
  }, [emptyLabel, options, query]);

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedValue("");
          setOpen(true);
        }}
        className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
      />

      <input type="hidden" name={name} value={selectedValue} required={required} />

      {open ? (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No results</p>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value || "__empty"}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setSelectedValue(option.value);
                  setQuery(formatDisplay(option));
                  setOpen(false);
                }}
                className="flex w-full items-start justify-between rounded-md px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-white/[0.06]"
              >
                <span className="text-sm text-gray-800 dark:text-white/90">{option.label}</span>
                {option.hint ? (
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{option.hint}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
