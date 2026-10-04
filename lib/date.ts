const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";
const DATE_STRING_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function formatDateParts({ year, month, day }: DateParts): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Parses a strict "YYYY-MM-DD" string into calendar components, rejecting
// both malformed input and dates that don't exist (e.g. 2026-02-30).
// Using Date.UTC (never the process's local time zone) keeps day-arithmetic
// unambiguous regardless of where this code runs.
function parseCalendarDate(dateStr: string): DateParts {
  if (!DATE_STRING_PATTERN.test(dateStr)) {
    throw new Error(`invalid_date: "${dateStr}" is not in YYYY-MM-DD format`);
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const roundTrip = new Date(Date.UTC(year, month - 1, day));

  const isRealCalendarDate =
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day;

  if (!isRealCalendarDate) {
    throw new Error(`invalid_date: "${dateStr}" is not a real calendar date`);
  }

  return { year, month, day };
}

// Returns today's calendar date in America/Sao_Paulo as "YYYY-MM-DD".
// This is the official "today" for all business rules (see PLAN.md).
export function todaySaoPaulo(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

// Throws if dateStr isn't a real "YYYY-MM-DD" calendar date; otherwise
// reports whether it's strictly after today in America/Sao_Paulo.
export function isFutureSaoPaulo(dateStr: string): boolean {
  const { year, month, day } = parseCalendarDate(dateStr);
  const today = parseCalendarDate(todaySaoPaulo());

  return (
    Date.UTC(year, month - 1, day) >
    Date.UTC(today.year, today.month - 1, today.day)
  );
}

// Adds a whole number of calendar days to a "YYYY-MM-DD" string, correctly
// rolling over month/year and leap-year boundaries. Throws for an invalid
// or nonexistent input date.
export function addDaysToDateString(dateStr: string, days: number): string {
  const { year, month, day } = parseCalendarDate(dateStr);
  const result = new Date(Date.UTC(year, month - 1, day) + days * 86_400_000);

  return formatDateParts({
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
  });
}

const WEEKDAY_NAMES_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const MONTH_NAME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SAO_PAULO_TIME_ZONE,
  month: "long",
});

// Formats a "YYYY-MM-DD" string as "Segunda, dia 12 de agosto" (pt-BR).
// Anchors at noon UTC before reading calendar fields, so the fixed
// America/Sao_Paulo offset can never roll the date to the previous day.
export function formatReviewDatePtBR(dateStr: string): string {
  const { year, month, day } = parseCalendarDate(dateStr);
  const anchor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekday = WEEKDAY_NAMES_PT[anchor.getUTCDay()];
  const monthName = MONTH_NAME_FORMATTER.format(anchor);
  return `${weekday}, dia ${day} de ${monthName}`;
}

// Converts a timestamptz (ISO string, e.g. review_logs.reviewed_at) into
// the America/Sao_Paulo calendar date it falls on — the same rule the
// database uses for "one review per day".
export function toSaoPauloDate(isoTimestamp: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(isoTimestamp));

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

// Whole calendar days from `from` to `to` (negative when `to` is earlier).
export function daysBetween(from: string, to: string): number {
  const a = parseCalendarDate(from);
  const b = parseCalendarDate(to);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000,
  );
}

// 0 = domingo … 6 = sábado.
export function weekdayIndex(dateStr: string): number {
  const { year, month, day } = parseCalendarDate(dateStr);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export const WEEKDAY_SHORT_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// "4 de outubro"
export function formatDayMonthPtBR(dateStr: string): string {
  const { month, day } = parseCalendarDate(dateStr);
  return `${day} de ${MONTHS_PT[month - 1]}`;
}

// "4 out"
export function formatShortDatePtBR(dateStr: string): string {
  const { month, day } = parseCalendarDate(dateStr);
  return `${day} ${MONTHS_PT[month - 1].slice(0, 3)}`;
}

// "Outubro de 2026", from "YYYY-MM"
export function formatMonthPtBR(monthStr: string): string {
  const { year, month } = parseCalendarDate(`${monthStr}-01`);
  const name = MONTHS_PT[month - 1];
  return `${name[0].toUpperCase()}${name.slice(1)} de ${year}`;
}

// "hoje", "amanhã", "ontem", "em 3 dias", "há 5 dias"
export function formatRelativeDayPtBR(dateStr: string, today: string): string {
  const diff = daysBetween(today, dateStr);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  return diff > 0 ? `em ${diff} dias` : `há ${-diff} dias`;
}

// Shifts a "YYYY-MM" month string by `delta` months.
export function addMonths(monthStr: string, delta: number): string {
  const { year, month } = parseCalendarDate(`${monthStr}-01`);
  const index = year * 12 + (month - 1) + delta;
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function isValidMonthString(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5));
  return month >= 1 && month <= 12;
}

export function isValidDateString(value: string | undefined): value is string {
  if (!value) return false;
  try {
    parseCalendarDate(value);
    return true;
  } catch {
    return false;
  }
}
