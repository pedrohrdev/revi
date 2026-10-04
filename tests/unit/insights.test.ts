import { describe, expect, it } from "vitest";
import {
  addMonths,
  daysBetween,
  formatRelativeDayPtBR,
  toSaoPauloDate,
  weekdayIndex,
} from "@/lib/date";
import {
  buildActivity,
  buildHeatmap,
  completedStages,
  computeStreak,
  groupByDate,
  intensityStep,
  projectSchedule,
  splitQueue,
  subjectColor,
  subjectStats,
  upcomingLoad,
  type ContentLike,
  type ReviewLogLike,
} from "@/lib/insights";

function content(overrides: Partial<ContentLike> & { id: string }): ContentLike {
  return {
    title: overrides.id,
    subject: null,
    status: "active",
    interval_index: 0,
    next_review_date: "2026-10-05",
    studied_at: "2026-10-04",
    last_reviewed_at: null,
    ...overrides,
  };
}

describe("date helpers", () => {
  it("converts a timestamp to the Sao Paulo calendar date", () => {
    expect(toSaoPauloDate("2026-03-15T02:30:00Z")).toBe("2026-03-14");
    expect(toSaoPauloDate("2026-03-15T03:30:00Z")).toBe("2026-03-15");
  });

  it("counts days between dates across months", () => {
    expect(daysBetween("2026-01-30", "2026-02-02")).toBe(3);
    expect(daysBetween("2026-02-02", "2026-01-30")).toBe(-3);
  });

  it("knows the weekday", () => {
    expect(weekdayIndex("2026-10-04")).toBe(0); // domingo
  });

  it("shifts months across years", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("formats relative days", () => {
    expect(formatRelativeDayPtBR("2026-10-04", "2026-10-04")).toBe("hoje");
    expect(formatRelativeDayPtBR("2026-10-05", "2026-10-04")).toBe("amanhã");
    expect(formatRelativeDayPtBR("2026-10-01", "2026-10-04")).toBe("há 3 dias");
  });
});

describe("projectSchedule", () => {
  it("projects every remaining review from the real next date", () => {
    const schedule = projectSchedule([
      content({ id: "a", interval_index: 2, next_review_date: "2026-10-10" }),
    ]);

    expect(schedule.map((item) => [item.stage, item.date, item.projected])).toEqual([
      [3, "2026-10-10", false],
      [4, "2026-10-25", true], // +15
      [5, "2026-11-24", true], // +30
    ]);
  });

  it("skips mastered and archived contents", () => {
    expect(
      projectSchedule([
        content({ id: "m", status: "mastered", next_review_date: null }),
        content({ id: "x", status: "archived" }),
      ]),
    ).toEqual([]);
  });
});

describe("splitQueue", () => {
  it("separates overdue, due today and already reviewed today", () => {
    const today = "2026-10-04";
    const queue = splitQueue(
      [
        content({ id: "late", next_review_date: "2026-10-01" }),
        content({ id: "now", next_review_date: today }),
        content({ id: "done", next_review_date: "2026-10-07", last_reviewed_at: today }),
        content({ id: "later", next_review_date: "2026-10-09" }),
      ],
      today,
    );

    expect(queue.overdue.map((c) => c.id)).toEqual(["late"]);
    expect(queue.today.map((c) => c.id)).toEqual(["now"]);
    expect(queue.doneToday.map((c) => c.id)).toEqual(["done"]);
  });
});

describe("upcomingLoad", () => {
  it("counts scheduled and projected reviews per day from tomorrow", () => {
    const schedule = projectSchedule([
      content({ id: "a", interval_index: 3, next_review_date: "2026-10-05" }),
    ]);
    const loads = upcomingLoad(schedule, "2026-10-04", 3);

    expect(loads).toEqual([
      { date: "2026-10-05", scheduled: 1, projected: 0 },
      { date: "2026-10-06", scheduled: 0, projected: 0 },
      { date: "2026-10-07", scheduled: 0, projected: 0 },
    ]);
  });
});

describe("buildActivity", () => {
  it("merges studies and reviews, newest day first, using Sao Paulo dates", () => {
    const contents = [content({ id: "a", studied_at: "2026-10-01" })];
    const logs: ReviewLogLike[] = [
      // 01:00 UTC on Oct 3 is still Oct 2 in Sao Paulo.
      { id: "l1", content_id: "a", interval_index_at_review: 0, reviewed_at: "2026-10-03T01:00:00Z" },
    ];
    const events = buildActivity(contents, logs);

    expect(events.map((e) => [e.kind, e.date, e.stage])).toEqual([
      ["reviewed", "2026-10-02", 1],
      ["studied", "2026-10-01", undefined],
    ]);
    expect(groupByDate(events).map((g) => g.date)).toEqual(["2026-10-02", "2026-10-01"]);
  });
});

describe("computeStreak", () => {
  it("counts up to yesterday when nothing happened yet today", () => {
    const dates = new Set(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(computeStreak(dates, "2026-10-04")).toEqual({ current: 3, best: 3, activeToday: false });
  });

  it("breaks on a missed day and remembers the best run", () => {
    const dates = new Set(["2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-10-04"]);
    expect(computeStreak(dates, "2026-10-04")).toEqual({ current: 1, best: 4, activeToday: true });
  });
});

describe("buildHeatmap", () => {
  it("builds Sunday-first weeks ending with the current week", () => {
    const grid = buildHeatmap(new Map([["2026-10-04", 2]]), "2026-10-07", 2);

    expect(grid).toHaveLength(2);
    expect(grid[1][0]).toEqual({ date: "2026-10-04", count: 2, future: false });
    expect(grid[1][6].future).toBe(true);
    expect(grid[0][0].date).toBe("2026-09-27");
  });

  it("maps counts to four intensity steps", () => {
    expect(intensityStep(0, 8)).toBe(0);
    expect(intensityStep(1, 8)).toBe(1);
    expect(intensityStep(8, 8)).toBe(4);
  });
});

describe("subjectStats", () => {
  it("aggregates per subject and puts contents without subject last", () => {
    const today = "2026-10-04";
    const contents = [
      content({ id: "a", subject: "Física", next_review_date: today }),
      content({ id: "b", subject: "Física", status: "mastered", next_review_date: null }),
      content({ id: "c", subject: null }),
    ];
    const logs: ReviewLogLike[] = [
      { id: "l", content_id: "b", interval_index_at_review: 4, reviewed_at: "2026-10-03T15:00:00Z" },
    ];
    const [fisica, none] = subjectStats(contents, logs, today);

    expect(fisica).toMatchObject({ subject: "Física", total: 2, mastered: 1, due: 1, reviews: 1 });
    expect(fisica.progress).toBeCloseTo(0.5);
    expect(fisica.lastActivity).toBe("2026-10-04");
    expect(none.subject).toBe("");
  });
});

describe("misc", () => {
  it("counts mastered contents as all stages complete", () => {
    expect(completedStages({ status: "mastered", interval_index: 4 })).toBe(5);
    expect(completedStages({ status: "active", interval_index: 2 })).toBe(2);
  });

  it("gives a subject the same color regardless of case or spacing", () => {
    expect(subjectColor("Física")).toBe(subjectColor(" física "));
  });
});
