"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon } from "@/icons";

type CountryOption = {
  code: string;
  dial: string;
};

type UserPhoneInputProps = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  countries?: CountryOption[];
};

const DEFAULT_COUNTRIES: CountryOption[] = [
  { code: "SN", dial: "+221" },
  { code: "CG", dial: "+242" },
  { code: "US", dial: "+1" },
  { code: "FR", dial: "+33" },
];

function normalizeLocalPart(value: string) {
  return value.replace(/[^\d]/g, "");
}

function splitPhone(defaultValue: string, countries: CountryOption[]) {
  const raw = (defaultValue || "").trim();
  const sorted = [...countries].sort((a, b) => b.dial.length - a.dial.length);
  const matched = sorted.find((country) => raw.startsWith(country.dial));

  if (!matched) {
    return { countryDial: countries[0]?.dial ?? "+221", local: raw.replace(/^\+/, "") };
  }

  return {
    countryDial: matched.dial,
    local: raw.slice(matched.dial.length).trim().replace(/^\+/, ""),
  };
}

export default function UserPhoneInput({
  name,
  defaultValue = "",
  placeholder = "70 000 00 00",
  countries = DEFAULT_COUNTRIES,
}: UserPhoneInputProps) {
  const initial = splitPhone(defaultValue, countries);
  const [dial, setDial] = useState(initial.countryDial);
  const [local, setLocal] = useState(initial.local);

  const finalPhone = useMemo(() => {
    const numericLocal = normalizeLocalPart(local);
    return `${dial}${numericLocal}`;
  }, [dial, local]);

  return (
    <div className="relative flex h-11 w-full overflow-hidden rounded-lg border border-gray-300 bg-transparent shadow-theme-xs focus-within:border-brand-300 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900">
      <div className="relative border-r border-gray-200 dark:border-gray-800">
        <select
          value={dial}
          onChange={(event) => setDial(event.target.value)}
          className="h-full appearance-none bg-transparent py-2 pl-3 pr-8 text-sm text-gray-800 outline-hidden dark:text-white/90"
        >
          {countries.map((country) => (
            <option
              key={country.code}
              value={country.dial}
              className="text-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              {country.code}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
          <ChevronDownIcon />
        </span>
      </div>

      <div className="pointer-events-none flex items-center border-r border-gray-200 px-3 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        {dial}
      </div>

      <input
        type="tel"
        value={local}
        onChange={(event) => setLocal(event.target.value)}
        placeholder={placeholder}
        className="h-full w-full bg-transparent px-3 text-sm text-gray-800 placeholder:text-gray-400 outline-hidden dark:text-white/90 dark:placeholder:text-white/30"
      />

      <input type="hidden" name={name} value={finalPhone} />
    </div>
  );
}
