import { addDaysToDateString, daysBetween, toSaoPauloDate, weekdayIndex } from "@/lib/date";
import { INTERVALS, computeNextReview } from "@/lib/review";

// Pure derivations over the user's contents + review history. Everything
// the dashboard, agenda, history and progress screens show is computed
// here from two queries — no extra tables, no per-item round-trips.

export const TOTAL_STAGES = INTERVALS.length;

export interface ContentLike {
  id: string;
  title: string;
  subject: string | null;
  status: string;
  interval_index: number;
  next_review_date: string | null;
  studied_at: string;
  last_reviewed_at: string | null;
}

export interface ReviewLogLike {
  id: string;
  content_id: string;
  interval_index_at_review: number;
  reviewed_at: string;
}

// Number of completed reviews (0..5) — what the stage ladder lights up.
export function completedStages(content: Pick<ContentLike, "status" | "interval_index">): number {
  return content.status === "mastered" ? TOTAL_STAGES : content.interval_index;
}

export interface ScheduledReview {
  contentId: string;
  title: string;
  subject: string | null;
  stage: number; // 1..5 — which review this is
  date: string;
  // false for the real next_review_date; true for later reviews that only
  // happen on that date if every earlier one is done on time.
  projected: boolean;
}

export function projectSchedule(contents: ContentLike[]): ScheduledReview[] {
  const schedule: ScheduledReview[] = [];

  for (const content of contents) {
    if (content.status !== "active" || !content.next_review_date) continue;

    let cursor = content.next_review_date;
    for (let index = content.interval_index; index < TOTAL_STAGES; index += 1) {
      if (index > content.interval_index) cursor = computeNextReview(index, cursor);
      schedule.push({
        contentId: content.id,
        title: content.title,
        subject: content.subject,
        stage: index + 1,
        date: cursor,
        projected: index > content.interval_index,
      });
    }
  }

  return schedule.sort((a, b) => a.date.localeCompare(b.date) || a.stage - b.stage);
}

export interface QueueBuckets<T> {
  overdue: T[];
  today: T[];
  doneToday: T[];
}

export function splitQueue<T extends ContentLike>(contents: T[], today: string): QueueBuckets<T> {
  const overdue: T[] = [];
  const dueToday: T[] = [];
  const doneToday: T[] = [];

  for (const content of contents) {
    if (content.last_reviewed_at === today) {
      doneToday.push(content);
      continue;
    }
    if (content.status !== "active" || !content.next_review_date) continue;
    if (content.next_review_date < today) overdue.push(content);
    else if (content.next_review_date === today) dueToday.push(content);
  }

  overdue.sort((a, b) => a.next_review_date!.localeCompare(b.next_review_date!));
  return { overdue, today: dueToday, doneToday };
}

export interface DayLoad {
  date: string;
  scheduled: number;
  projected: number;
}

// Review load for the next `days` days starting tomorrow.
export function upcomingLoad(schedule: ScheduledReview[], today: string, days = 14): DayLoad[] {
  const loads: DayLoad[] = [];
  const byDate = new Map<string, DayLoad>();

  for (let i = 1; i <= days; i += 1) {
    const date = addDaysToDateString(today, i);
    const load = { date, scheduled: 0, projected: 0 };
    loads.push(load);
    byDate.set(date, load);
  }

  for (const item of schedule) {
    const load = byDate.get(item.date);
    if (!load) continue;
    if (item.projected) load.projected += 1;
    else load.scheduled += 1;
  }

  return loads;
}

export type ActivityKind = "studied" | "reviewed";

export interface ActivityEvent {
  kind: ActivityKind;
  date: string;
  contentId: string;
  title: string;
  subject: string | null;
  stage?: number; // for reviews: 1..5
  at?: string; // exact timestamp, for reviews
}

export function buildActivity(contents: ContentLike[], logs: ReviewLogLike[]): ActivityEvent[] {
  const byId = new Map(contents.map((content) => [content.id, content]));
  const events: ActivityEvent[] = [];

  for (const content of contents) {
    events.push({
      kind: "studied",
      date: content.studied_at,
      contentId: content.id,
      title: content.title,
      subject: content.subject,
    });
  }

  for (const log of logs) {
    const content = byId.get(log.content_id);
    if (!content) continue;
    events.push({
      kind: "reviewed",
      date: toSaoPauloDate(log.reviewed_at),
      contentId: content.id,
      title: content.title,
      subject: content.subject,
      stage: log.interval_index_at_review + 1,
      at: log.reviewed_at,
    });
  }

  // Newest day first; within a day, reviews (timestamped) newest first and
  // studies after them.
  return events.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (b.at ?? "").localeCompare(a.at ?? "") ||
      a.title.localeCompare(b.title),
  );
}

export function groupByDate<T extends { date: string }>(items: T[]): { date: string; items: T[] }[] {
  const groups: { date: string; items: T[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }
  return groups;
}

export function activityCounts(events: ActivityEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.date, (counts.get(event.date) ?? 0) + 1);
  return counts;
}

// A day "counts" for the streak when the student studied or reviewed
// something. The current streak survives until the end of today: if
// nothing happened yet today, it is counted up to yesterday.
export function computeStreak(
  activeDates: Set<string>,
  today: string,
): { current: number; best: number; activeToday: boolean } {
  const activeToday = activeDates.has(today);
  let current = 0;
  let cursor = activeToday ? today : addDaysToDateString(today, -1);
  while (activeDates.has(cursor)) {
    current += 1;
    cursor = addDaysToDateString(cursor, -1);
  }

  const sorted = [...activeDates].filter((date) => date <= today).sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of sorted) {
    run = previous && daysBetween(previous, date) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }

  return { current, best: Math.max(best, current), activeToday };
}

export interface HeatmapCell {
  date: string;
  count: number;
  future: boolean;
}

// Columns are weeks (Sunday-first), ending with the week that contains
// today — same layout as GitHub/Anki contribution grids.
export function buildHeatmap(counts: Map<string, number>, today: string, weeks = 26): HeatmapCell[][] {
  const lastSunday = addDaysToDateString(today, -weekdayIndex(today));
  const start = addDaysToDateString(lastSunday, -(weeks - 1) * 7);
  const columns: HeatmapCell[][] = [];

  for (let week = 0; week < weeks; week += 1) {
    const column: HeatmapCell[] = [];
    for (let day = 0; day < 7; day += 1) {
      const date = addDaysToDateString(start, week * 7 + day);
      column.push({ date, count: counts.get(date) ?? 0, future: date > today });
    }
    columns.push(column);
  }

  return columns;
}

// Maps a count to a 0..4 intensity step, relative to the busiest day.
export function intensityStep(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
}

export interface SubjectStats {
  subject: string; // "" = sem matéria
  total: number;
  active: number;
  mastered: number;
  archived: number;
  due: number; // active and due today or overdue
  reviews: number;
  lastActivity: string | null;
  // Average completed stages of non-archived contents, 0..1.
  progress: number;
}

export function subjectStats(
  contents: ContentLike[],
  logs: ReviewLogLike[],
  today: string,
): SubjectStats[] {
  const bySubject = new Map<string, SubjectStats & { stageSum: number; counted: number }>();
  const subjectOf = new Map<string, string>();

  for (const content of contents) {
    const key = content.subject?.trim() ?? "";
    subjectOf.set(content.id, key);
    const stats =
      bySubject.get(key) ??
      {
        subject: key,
        total: 0,
        active: 0,
        mastered: 0,
        archived: 0,
        due: 0,
        reviews: 0,
        lastActivity: null,
        progress: 0,
        stageSum: 0,
        counted: 0,
      };
    stats.total += 1;
    if (content.status === "active") stats.active += 1;
    if (content.status === "mastered") stats.mastered += 1;
    if (content.status === "archived") stats.archived += 1;
    if (content.status === "active" && content.next_review_date && content.next_review_date <= today) {
      stats.due += 1;
    }
    if (content.status !== "archived") {
      stats.stageSum += completedStages(content);
      stats.counted += 1;
    }
    if (!stats.lastActivity || content.studied_at > stats.lastActivity) {
      stats.lastActivity = content.studied_at;
    }
    bySubject.set(key, stats);
  }

  for (const log of logs) {
    const key = subjectOf.get(log.content_id);
    if (key === undefined) continue;
    const stats = bySubject.get(key)!;
    stats.reviews += 1;
    const date = toSaoPauloDate(log.reviewed_at);
    if (!stats.lastActivity || date > stats.lastActivity) stats.lastActivity = date;
  }

  return [...bySubject.values()]
    .map(({ stageSum, counted, ...stats }) => ({
      ...stats,
      progress: counted > 0 ? stageSum / (counted * TOTAL_STAGES) : 0,
    }))
    .sort((a, b) => {
      if (!a.subject) return 1;
      if (!b.subject) return -1;
      return b.due - a.due || a.subject.localeCompare(b.subject, "pt-BR");
    });
}

// Stable per-subject hue from a fixed set — derived from the subject's
// name (never its position in a list), so a subject keeps its color as
// others are added or filtered out. Always shown next to the subject's
// name, never as the only cue.
// Dark-mode categorical steps minus yellow (that's the stage accent).
// A subject's color is only a secondary cue: its name is always shown
// beside the dot, so a shared or hard-to-tell-apart hue never hides
// which subject it is.
const SUBJECT_HUES = ["#3987e5", "#d95926", "#199e70", "#d55181", "#9085e9", "#e66767", "#008300"];

// The usual school subjects get fixed, well-spread colors (exatas and
// humanas never share one); anything else falls back to a name hash.
const KNOWN_SUBJECTS: Record<string, number> = {
  matematica: 0,
  fisica: 4,
  quimica: 1,
  biologia: 6,
  historia: 5,
  geografia: 2,
  portugues: 3,
  literatura: 4,
  redacao: 0,
  ingles: 2,
  espanhol: 1,
  filosofia: 6,
  sociologia: 3,
  artes: 5,
};

export function subjectColor(subject: string | null | undefined): string {
  const key = subject?.trim().toLocaleLowerCase("pt-BR") ?? "";
  if (!key) return "#5c5c58";
  const plain = key.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const known = KNOWN_SUBJECTS[plain];
  if (known !== undefined) return SUBJECT_HUES[known];
  // FNV-1a: spreads short, similar names better than a plain *31 hash.
  let hash = 0x811c9dc5;
  for (const char of plain) hash = Math.imul(hash ^ char.codePointAt(0)!, 0x01000193) >>> 0;
  return SUBJECT_HUES[hash % SUBJECT_HUES.length];
}
