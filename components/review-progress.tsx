"use client";

import type { MouseEvent } from "react";
import { cn } from "cn";
import { formatReviewDatePtBR } from "@/lib/date";
import { computeNextReview } from "@/lib/review";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

const TOTAL_REVIEWS = 5;

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
      knownDates.set(dotNumber, log.reviewedAt.slice(0, 10));
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
      return { title: `Revisão ${dot} feita`, description: "Data exata não disponível aqui." };
    case "next":
      return { title: `Revisão ${dot} agendada`, description: formatReviewDatePtBR(state.date) };
    case "projected":
      return {
        title: `Revisão ${dot} (previsão)`,
        description: `${formatReviewDatePtBR(state.date)} — se as anteriores forem feitas em dia.`,
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
  className,
}: {
  intervalIndex: number;
  status: string;
  nextReviewDate?: string | null;
  reviewLogs?: ReviewLogEntry[];
  className?: string;
}) {
  const states = computeDotStates({ intervalIndex, status, nextReviewDate, reviewLogs });

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      aria-label={`${status === "mastered" ? TOTAL_REVIEWS : intervalIndex} de ${TOTAL_REVIEWS} revisões concluídas`}
    >
      {states.map((state, i) => {
        const dot = i + 1;
        const done = state.kind === "done-known" || state.kind === "done-unknown";
        const { title, description } = dotLabel(state, dot);

        return (
          <Popover key={dot}>
            <PopoverTrigger
              onClick={(e: MouseEvent) => e.stopPropagation()}
              className={cn(
                "flex size-6 cursor-pointer items-center justify-center rounded-full text-xs font-medium transition-all duration-300 ease-out hover:scale-110",
                done
                  ? "scale-100 bg-primary text-primary-foreground"
                  : state.kind === "next"
                    ? "scale-100 bg-accent text-accent-foreground ring-2 ring-primary/50"
                    : "scale-90 bg-muted text-muted-foreground",
              )}
            >
              {dot}
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <PopoverTitle>{title}</PopoverTitle>
              <PopoverDescription>{description}</PopoverDescription>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
