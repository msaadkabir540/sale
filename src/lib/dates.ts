export const REPORT_MAX_DAYS = 366;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value || !ISO_DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === value ? date : null;
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

export function addDays(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  if (!date) throw new Error(`Invalid ISO date: ${isoDate}`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function daysInclusive(from: string, to: string): number {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end) return 0;
  const days = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  return days > 0 ? days : 0;
}

export function startOfWeek(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  if (!date) throw new Error(`Invalid ISO date: ${isoDate}`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return toIsoDate(date);
}

export function startOfMonth(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  if (!date) throw new Error(`Invalid ISO date: ${isoDate}`);
  return toIsoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
}

export function endOfMonth(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  if (!date) throw new Error(`Invalid ISO date: ${isoDate}`);
  return toIsoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
}

export type DateRange = { from: string; to: string };

export type ReportPeriod = "today" | "week" | "month" | "last_month" | "custom";

export const REPORT_PERIODS: readonly { value: ReportPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Custom range" },
];

export function isReportPeriod(value: string | undefined): value is ReportPeriod {
  return REPORT_PERIODS.some((period) => period.value === value);
}

export function resolveReportRange(
  period: ReportPeriod,
  options: { today: string; from?: string | null; to?: string | null },
): DateRange | null {
  const { today } = options;

  switch (period) {
    case "today":
      return { from: today, to: today };
    case "week": {
      const from = startOfWeek(today);
      return { from, to: addDays(from, 6) };
    }
    case "month":
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case "last_month": {
      const previousMonthDay = addDays(startOfMonth(today), -1);
      return { from: startOfMonth(previousMonthDay), to: endOfMonth(previousMonthDay) };
    }
    case "custom": {
      const { from, to } = options;
      if (!from || !to || !parseIsoDate(from) || !parseIsoDate(to)) return null;
      if (from > to) return null;
      if (daysInclusive(from, to) > REPORT_MAX_DAYS) return null;
      return { from, to };
    }
  }
}

const displayDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(isoDate: string | null | undefined): string {
  const date = parseIsoDate(isoDate);
  return date ? displayDateFormatter.format(date) : "—";
}

export function formatMonth(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  return date ? monthFormatter.format(date) : "—";
}

export function formatDateRange(from: string, to: string): string {
  if (from === to) return formatDate(from);
  return `${formatDate(from)} – ${formatDate(to)}`;
}

export function formatReportPeriodLabel(period: ReportPeriod, range: DateRange): string {
  switch (period) {
    case "today":
      return `Today · ${formatDate(range.from)}`;
    case "week":
      return `Week of ${formatDate(range.from)}`;
    case "month":
      return formatMonth(range.from);
    case "last_month":
      return formatMonth(range.from);
    case "custom":
      return "Custom range";
  }
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${dateTimeFormatter.format(date)} UTC`;
}
