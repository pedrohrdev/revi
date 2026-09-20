import { describe, expect, it } from "vitest";
import { INTERVALS, computeNextReview, isLastInterval } from "@/lib/review";

describe("INTERVALS", () => {
  it("is the fixed incremental sequence from PLAN.md", () => {
    expect(INTERVALS).toEqual([1, 3, 7, 15, 30]);
  });
});

describe("computeNextReview", () => {
  it("walks the full review cycle, matching the accumulated-day table in PLAN.md", () => {
    // studied_at = 2026-01-01 (day 0). Each step feeds the previous review's
    // date back in, exactly like mark_content_reviewed does in the RPC.
    const studiedAt = "2026-01-01";

    const firstReviewDate = computeNextReview(0, studiedAt);
    expect(firstReviewDate).toBe("2026-01-02"); // day 1

    const secondReviewDate = computeNextReview(1, firstReviewDate);
    expect(secondReviewDate).toBe("2026-01-05"); // day 4

    const thirdReviewDate = computeNextReview(2, secondReviewDate);
    expect(thirdReviewDate).toBe("2026-01-12"); // day 11

    const fourthReviewDate = computeNextReview(3, thirdReviewDate);
    expect(fourthReviewDate).toBe("2026-01-27"); // day 26

    const fifthReviewDate = computeNextReview(4, fourthReviewDate);
    expect(fifthReviewDate).toBe("2026-02-26"); // day 56 (Jan has 31 days)

    // The 5th review is the one that completes the cycle (→ mastered).
    expect(isLastInterval(4)).toBe(true);
  });

  it("is relative to the last review date, not cumulative from studied_at", () => {
    // Reviewing late doesn't "catch up" to a fixed calendar schedule: the
    // next interval is always added to whenever the review actually happened.
    expect(computeNextReview(1, "2026-05-01")).toBe("2026-05-04");
    expect(computeNextReview(1, "2026-05-20")).toBe("2026-05-23");
  });

  it("rolls over month and leap-year boundaries like the underlying date arithmetic", () => {
    expect(computeNextReview(4, "2028-01-30")).toBe("2028-02-29"); // +30 days, leap year
  });

  it.each([-1, 5, 1.5, Number.NaN])(
    "throws for an out-of-range interval index (%s)",
    (invalidIndex) => {
      expect(() => computeNextReview(invalidIndex, "2026-01-01")).toThrow(
        /invalid_interval_index/,
      );
    },
  );

  it("throws for a nonexistent fromDate", () => {
    expect(() => computeNextReview(0, "2026-02-30")).toThrow(/invalid_date/);
  });
});

describe("isLastInterval", () => {
  it("is false for every index except the last", () => {
    expect(isLastInterval(0)).toBe(false);
    expect(isLastInterval(1)).toBe(false);
    expect(isLastInterval(2)).toBe(false);
    expect(isLastInterval(3)).toBe(false);
  });

  it("is true only at the last valid index", () => {
    expect(isLastInterval(INTERVALS.length - 1)).toBe(true);
  });
});
