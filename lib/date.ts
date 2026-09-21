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
