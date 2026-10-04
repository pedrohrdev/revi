"use client";

import type { MouseEvent } from "react";
import { cn } from "cn";
import { formatReviewDatePtBR, toSaoPauloDate } from "@/lib/date";
import { computeNextReview } from "@/lib/review";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

const TOTAL_REVIEWS = 5;

// Sequential ramp: each completed review lights its segment a little
// brighter, so a content's "memory strength" reads at a glance.
const STAGE_FILL = ["bg-stage-1", "bg-stage-2", "bg-stage-3", "bg-stage-4", "bg-stage-5"];

export interface ReviewLogEntry {
  intervalIndexAtReview: number;
  reviewedAt: string;
}

type DotState =
  | { kind: "done-known"; date: string }
  | { kind: "done-unknown" }
  | { kind: "next"; date: string }
  | { kind: "projected"; date: string }
  | { kind: "pending" };

function computeDotStates({
  intervalIndex,
  status,
  nextReviewDate,
  reviewLogs,
}: {
  intervalIndex: number;
  status: string;
  nextReviewDate: string | null;
  reviewLogs?: ReviewLogEntry[];
}): DotState[] {
  const completed = status === "mastered" ? TOTAL_REVIEWS : intervalIndex;
  const knownDates = new Map<number, string>();
  for (const log of reviewLogs ?? []) {
    const dotNumber = log.intervalIndexAtReview + 1;
    if (dotNumber >= 1 && dotNumber <= TOTAL_REVIEWS) {
      knownDates.set(dotNumber, toSaoPauloDate(log.reviewedAt));
    }
  }

  const states: DotState[] = [];
  const nextDotNumber = intervalIndex + 1;
  let projectedCursor = nextReviewDate;

  for (let dot = 1; dot <= TOTAL_REVIEWS; dot += 1) {
    if (dot <= completed) {
      const known = knownDates.get(dot);
      states.push(known ? { kind: "done-known", date: known } : { kind: "done-unknown" });
      continue;
    }

    if (status !== "active" || !projectedCursor) {
      states.push({ kind: "pending" });
      continue;
    }

    if (dot === nextDotNumber) {
      states.push({ kind: "next", date: projectedCursor });
    } else {
      projectedCursor = computeNextReview(dot - 1, projectedCursor);
      states.push({ kind: "projected", date: projectedCursor });
    }
  }

  return states;
}

function dotLabel(state: DotState, dot: number): { title: string; description: string } {
  switch (state.kind) {
    case "done-known":
      return {
        title: `Revisão ${dot} feita`,
        description: formatReviewDatePtBR(state.date),
      };
    case "done-unknown":
      return { title: `Revisão ${dot} feita`, description: "Abra o conteúdo para ver a data." };
    case "next":
      return { title: `Revisão ${dot} agendada`, description: formatReviewDatePtBR(state.date) };
    case "projected":
      return {
        title: `Revisão ${dot} (previsão)`,
        description: `${formatReviewDatePtBR(state.date)}, se as anteriores forem feitas em dia.`,
      };
    case "pending":
      return { title: `Revisão ${dot}`, description: "Ainda sem data definida." };
  }
}

export function ReviewProgress({
  intervalIndex,
  status,
  nextReviewDate = null,
  reviewLogs,
  size = "default",
  className,
}: {
  intervalIndex: number;
  status: string;
  nextReviewDate?: string | null;
  reviewLogs?: ReviewLogEntry[];
  size?: "default" | "lg";
  className?: string;
}) {
  const states = computeDotStates({ intervalIndex, status, nextReviewDate, reviewLogs });
  const completed = status === "mastered" ? TOTAL_REVIEWS : intervalIndex;

  return (
    <div
      className={cn("flex items-center", className)}
      role="group"
      aria-label={`${completed} de ${TOTAL_REVIEWS} revisões concluídas`}
    >
      {states.map((state, i) => {
        const dot = i + 1;
        const done = state.kind === "done-known" || state.kind === "done-unknown";
        const { title, description } = dotLabel(state, dot);

        return (
          <Popover key={dot}>
            <PopoverTrigger
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              aria-label={title}
              className="group/seg flex cursor-pointer items-center px-[2px] py-2 outline-none"
            >
              <span
                className={cn(
                  "block rounded-full transition-all duration-300 group-hover/seg:scale-y-150 group-focus-visible/seg:ring-2 group-focus-visible/seg:ring-ring",
                  size === "lg" ? "h-2 w-10 sm:w-14" : "h-1.5 w-5",
                  done
                    ? STAGE_FILL[i]
                    : state.kind === "next"
                      ? "bg-transparent ring-1 ring-primary/70 ring-inset"
                      : "bg-stage-0",
                )}
              />
            </PopoverTrigger>
            <PopoverContent className="w-60">
              <PopoverTitle>{title}</PopoverTitle>
              <PopoverDescription>{description}</PopoverDescription>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
