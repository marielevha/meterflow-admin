"use client";

import { useState } from "react";
import Select from "@/components/form/Select";
import { ChevronDownIcon } from "@/icons";

type UserEditSelectProps = {
  name: string;
  defaultValue: string;
  options: Array<string | { value: string; label: string }>;
  placeholder?: string;
};

export default function UserEditSelect({
  name,
  defaultValue,
  options,
  placeholder,
}: UserEditSelectProps) {
  const [value, setValue] = useState(defaultValue);
  const normalizedOptions = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option
  );

  return (
    <div className="relative">
      <Select
        options={normalizedOptions}
        defaultValue={defaultValue}
        onChange={setValue}
        placeholder={placeholder}
        className="dark:bg-dark-900"
      />
      <input type="hidden" name={name} value={value} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
        <ChevronDownIcon />
      </span>
    </div>
  );
}
