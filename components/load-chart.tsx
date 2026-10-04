import Link from "next/link";
import type { DayLoad } from "@/lib/insights";
import { formatReviewDatePtBR, weekdayIndex } from "@/lib/date";

// Upcoming review load, one column per day. Two stacked series: reviews
// already scheduled (solid) and later reviews projected from them
// (hatched). Each column links to that day in the agenda.
export function LoadChart({ loads }: { loads: DayLoad[] }) {
  const max = Math.max(1, ...loads.map((load) => load.scheduled + load.projected));
  const height = 96;

  return (
    <figure className="space-y-3">
      <div className="flex items-end gap-1" style={{ height: height + 20 }}>
        {loads.map((load) => {
          const total = load.scheduled + load.projected;
          const scheduledH = (load.scheduled / max) * height;
          const projectedH = (load.projected / max) * height;
          const weekday = weekdayIndex(load.date);
          const label = `${formatReviewDatePtBR(load.date)}: ${load.scheduled} agendada${load.scheduled === 1 ? "" : "s"}${load.projected ? `, ${load.projected} prevista${load.projected === 1 ? "" : "s"}` : ""}`;

          return (
            <Link
              key={load.date}
              href={`/agenda?d=${load.date}`}
              title={label}
              aria-label={label}
              className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-[10px] text-muted-foreground opacity-0 tabular transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {total}
              </span>
              <span className="flex w-full max-w-5 flex-col justify-end gap-[2px]">
                {projectedH > 0 ? (
                  <span
                    className="block w-full rounded-t-[4px] bg-[repeating-linear-gradient(135deg,var(--stage-2)_0_2px,transparent_2px_5px)] ring-1 ring-stage-2 ring-inset"
                    style={{ height: Math.max(3, projectedH) }}
                  />
                ) : null}
                {scheduledH > 0 ? (
                  <span
                    className={`block w-full bg-primary ${projectedH > 0 ? "" : "rounded-t-[4px]"}`}
                    style={{ height: Math.max(3, scheduledH) }}
                  />
                ) : null}
                {total === 0 ? <span className="block h-[2px] w-full rounded-full bg-stage-0" /> : null}
              </span>
              <span
                className={`text-[10px] tabular ${weekday === 0 || weekday === 6 ? "text-muted-foreground/60" : "text-muted-foreground"}`}
              >
                {Number(load.date.slice(8))}
              </span>
            </Link>
          );
        })}
      </div>
      <figcaption className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-primary" aria-hidden />
          Agendadas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-[3px] bg-[repeating-linear-gradient(135deg,var(--stage-2)_0_2px,transparent_2px_4px)] ring-1 ring-stage-2 ring-inset"
            aria-hidden
          />
          Previstas, se você revisar em dia
        </span>
      </figcaption>
    </figure>
  );
}
