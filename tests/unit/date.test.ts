import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDaysToDateString, isFutureSaoPaulo, todaySaoPaulo } from "@/lib/date";

describe("todaySaoPaulo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the Sao Paulo calendar date, not the UTC one, just before local midnight", () => {
    // 02:30 UTC on Mar 15 is 23:30 on Mar 14 in America/Sao_Paulo (UTC-3).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T02:30:00Z"));

    expect(todaySaoPaulo()).toBe("2026-03-14");
  });

  it("rolls over to the next day right after Sao Paulo midnight", () => {
    // 03:30 UTC on Mar 15 is 00:30 on Mar 15 in America/Sao_Paulo.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T03:30:00Z"));

    expect(todaySaoPaulo()).toBe("2026-03-15");
  });

  it("handles a Sao Paulo year boundary correctly", () => {
    // 01:00 UTC on Jan 1 is 22:00 on Dec 31 in America/Sao_Paulo.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01T01:00:00Z"));

    expect(todaySaoPaulo()).toBe("2026-12-31");
  });
});

describe("isFutureSaoPaulo", () => {
  beforeEach(() => {
    // Freeze "today" at 2026-06-15 in America/Sao_Paulo (15:00 UTC is
    // comfortably 12:00 in Sao Paulo, away from any day boundary).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T15:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false for today itself", () => {
    expect(isFutureSaoPaulo("2026-06-15")).toBe(false);
  });

  it("returns false for a past date", () => {
    expect(isFutureSaoPaulo("2026-06-14")).toBe(false);
  });

  it("returns true for a future date", () => {
    expect(isFutureSaoPaulo("2026-06-16")).toBe(true);
  });

  it.each(["2026-6-15", "2026-06-5", "20260615", "2026/06/15", "", "not-a-date"])(
    "throws for a malformed date string %s",
    (malformed) => {
      expect(() => isFutureSaoPaulo(malformed)).toThrow(/invalid_date/);
    },
  );

  it.each([
    "2026-02-30", // February never has 30 days
    "2026-13-01", // month 13 doesn't exist
    "2026-00-10", // month 0 doesn't exist
    "2026-04-31", // April has 30 days
    "2023-02-29", // 2023 is not a leap year
  ])("throws for the nonexistent calendar date %s", (nonexistent) => {
    expect(() => isFutureSaoPaulo(nonexistent)).toThrow(/invalid_date/);
  });
});

describe("addDaysToDateString", () => {
  it("adds days within the same month", () => {
    expect(addDaysToDateString("2026-06-15", 1)).toBe("2026-06-16");
  });

  it("rolls over an end-of-month boundary", () => {
    expect(addDaysToDateString("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("rolls over a year boundary", () => {
    expect(addDaysToDateString("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("accounts for a leap year (2028-02-29 exists)", () => {
    expect(addDaysToDateString("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("skips straight to March in a non-leap year", () => {
    expect(addDaysToDateString("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("adds a multi-day interval spanning a month boundary", () => {
    expect(addDaysToDateString("2026-01-20", 15)).toBe("2026-02-04");
  });

  it("throws for a nonexistent starting date", () => {
    expect(() => addDaysToDateString("2026-02-30", 1)).toThrow(/invalid_date/);
  });
});
