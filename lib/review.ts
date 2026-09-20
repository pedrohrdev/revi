import { addDaysToDateString } from "@/lib/date";

// Incremental/relative to the last review, not cumulative from studied_at —
// see "Semântica dos intervalos" in PLAN.md for the accumulated-day table
// this produces (1, 4, 11, 26, 56 days after studied_at).
export const INTERVALS = [1, 3, 7, 15, 30] as const;

// Given the interval index a content will be AT after a review (0 for the
// initial next_review_date on creation, or interval_index + 1 after
// mark_content_reviewed advances it), returns the next review date. Mirrors
// the mark_content_reviewed RPC's SQL formula exactly (see PLAN.md).
export function computeNextReview(intervalIndex: number, fromDate: string): string {
  if (!Number.isInteger(intervalIndex) || intervalIndex < 0 || intervalIndex >= INTERVALS.length) {
    throw new Error(
      `invalid_interval_index: ${intervalIndex} must be an integer in [0, ${INTERVALS.length - 1}]`,
    );
  }

  return addDaysToDateString(fromDate, INTERVALS[intervalIndex]);
}

// True when intervalIndex is the content's last interval before mastery —
// i.e. the next review (not this one) will mark it as `mastered`.
export function isLastInterval(intervalIndex: number): boolean {
  return intervalIndex === INTERVALS.length - 1;
}
