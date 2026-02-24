import type { AppSettings } from "@/lib/settings/appSettings";

function normalizeDay(day: number) {
  const value = Math.round(day);
  if (!Number.isFinite(value)) return 1;
  return Math.min(31, Math.max(1, value));
}

function getUtcPartsInTimezone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");

  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
    second: pick("second"),
  };
}

function isReminderDay(day: number, cadence: AppSettings["readingReminderCadence"]) {
  if (cadence === "DAILY") return true;
  if (cadence === "EVERY_2_DAYS") return day % 2 === 0;
  return day % 3 === 0;
}

export function isWithinReadingReminderWindow(date: Date, settings: AppSettings) {
  if (!settings.readingReminderEnabled) return false;

  const parts = getUtcPartsInTimezone(date, settings.readingReminderTimezone || "UTC");
  const start = normalizeDay(settings.readingWindowStartDay);
  const end = normalizeDay(settings.readingWindowEndDay);
  const day = parts.day;

  if (start <= end) return day >= start && day <= end;
  return day >= start || day <= end;
}

export function shouldTriggerReadingReminder(date: Date, settings: AppSettings) {
  if (!isWithinReadingReminderWindow(date, settings)) return false;

  const parts = getUtcPartsInTimezone(date, settings.readingReminderTimezone || "UTC");
  const targetHour = Math.max(0, Math.min(23, settings.readingReminderHour));

  if (parts.hour !== targetHour) return false;
  return isReminderDay(parts.day, settings.readingReminderCadence);
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getReminderWindowBounds(date: Date, settings: AppSettings) {
  const tz = settings.readingReminderTimezone || "UTC";
  const parts = getUtcPartsInTimezone(date, tz);
  const startDay = normalizeDay(settings.readingWindowStartDay);
  const endDay = normalizeDay(settings.readingWindowEndDay);

  const currentMonth = parts.month;
  const currentYear = parts.year;

  const endInSameMonth = startDay <= endDay;

  if (endInSameMonth) {
    const maxDay = lastDayOfMonth(currentYear, currentMonth);
    const windowStart = new Date(Date.UTC(currentYear, currentMonth - 1, Math.min(startDay, maxDay), 0, 0, 0));
    const windowEnd = new Date(Date.UTC(currentYear, currentMonth - 1, Math.min(endDay, maxDay), 23, 59, 59, 999));
    return {
      windowStart,
      windowEnd,
      reminderWindowKey: `${currentYear}-${String(currentMonth).padStart(2, "0")}-${startDay}-${endDay}`,
    };
  }

  if (parts.day >= startDay) {
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    const currentMax = lastDayOfMonth(currentYear, currentMonth);
    const nextMax = lastDayOfMonth(nextYear, nextMonth);
    const windowStart = new Date(Date.UTC(currentYear, currentMonth - 1, Math.min(startDay, currentMax), 0, 0, 0));
    const windowEnd = new Date(Date.UTC(nextYear, nextMonth - 1, Math.min(endDay, nextMax), 23, 59, 59, 999));
    return {
      windowStart,
      windowEnd,
      reminderWindowKey: `${currentYear}-${String(currentMonth).padStart(2, "0")}-${startDay}-${endDay}`,
    };
  }

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const prevMax = lastDayOfMonth(prevYear, prevMonth);
  const currentMax = lastDayOfMonth(currentYear, currentMonth);
  const windowStart = new Date(Date.UTC(prevYear, prevMonth - 1, Math.min(startDay, prevMax), 0, 0, 0));
  const windowEnd = new Date(Date.UTC(currentYear, currentMonth - 1, Math.min(endDay, currentMax), 23, 59, 59, 999));
  return {
    windowStart,
    windowEnd,
    reminderWindowKey: `${prevYear}-${String(prevMonth).padStart(2, "0")}-${startDay}-${endDay}`,
  };
}
