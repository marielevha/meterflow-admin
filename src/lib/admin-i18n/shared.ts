import type { AdminMessages } from "@/lib/admin-i18n/messages";

function readPath(input: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[segment];
  }, input);
}

export function interpolateMessage(template: string, values?: Record<string, string | number>) {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function translateAdminMessage(
  messages: AdminMessages,
  key: string,
  values?: Record<string, string | number>
) {
  const resolved = readPath(messages as unknown as Record<string, unknown>, key);
  if (typeof resolved !== "string") return key;
  return interpolateMessage(resolved, values);
}
