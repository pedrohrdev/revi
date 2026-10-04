import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "cn";
import { ArrowLeftIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getContentById, getReviewLogs } from "@/lib/data/contents";
import {
  daysBetween,
  formatRelativeDayPtBR,
  formatReviewDatePtBR,
  toSaoPauloDate,
  todaySaoPaulo,
} from "@/lib/date";
import { computeNextReview, INTERVALS } from "@/lib/review";
import { ContentActions } from "@/components/content-actions";
import { ReviewProgress } from "@/components/review-progress";
import { SubjectTag } from "@/components/subject-tag";

export const metadata: Metadata = { title: "Conteúdo" };

// formatReviewDatePtBR starts with a capital weekday; mid-sentence it
// reads "feita em sexta, dia 2 de outubro".
function inSentence(dateStr: string): string {
  const text = formatReviewDatePtBR(dateStr);
  return text[0].toLowerCase() + text.slice(1);
}

const STATUS_LABELS: Record<string, string> = {
  active: "Em revisão",
  mastered: "Dominado",
  archived: "Arquivado",
};

type Step =
  | { kind: "done"; date: string; lateBy: number }
  | { kind: "next"; date: string }
  | { kind: "projected"; date: string }
  | { kind: "pending" };

export default async function ContentDetailPage(props: PageProps<"/contents/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();

  const content = await getContentById(supabase, id);
  if (!content) notFound();

  const logs = await getReviewLogs(supabase, id);
  const today = todaySaoPaulo();

  // Current cycle only: a reset restarts studied_at but keeps old logs.
  const cycleLogs = logs.filter((log) => toSaoPauloDate(log.reviewed_at) >= content.studied_at);
  const doneDate = new Map<number, string>();
  for (const log of cycleLogs) doneDate.set(log.interval_index_at_review, toSaoPauloDate(log.reviewed_at));

  const completed = content.status === "mastered" ? INTERVALS.length : content.interval_index;
  const steps: Step[] = [];
  let expected = content.studied_at;
  let cursor = content.next_review_date;
  for (let index = 0; index < INTERVALS.length; index += 1) {
    if (index < completed) {
      const date = doneDate.get(index);
      const due = computeNextReview(index, expected);
      if (date) {
        steps.push({ kind: "done", date, lateBy: Math.max(0, daysBetween(due, date)) });
        expected = date;
      } else {
        steps.push({ kind: "pending" });
      }
      continue;
    }
    if (content.status !== "active" || !cursor) {
      steps.push({ kind: "pending" });
      continue;
    }
    if (index === content.interval_index) {
      steps.push({ kind: "next", date: cursor });
    } else {
      cursor = computeNextReview(index, cursor);
      steps.push({ kind: "projected", date: cursor });
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-4 py-8 sm:px-8 lg:py-12">
      <Link
        href="/contents"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Conteúdos
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <SubjectTag subject={content.subject} />
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              content.status === "mastered" && "bg-primary text-primary-foreground",
              content.status === "active" && "bg-secondary text-foreground",
              content.status === "archived" && "border border-border text-muted-foreground",
            )}
          >
            {STATUS_LABELS[content.status] ?? content.status}
          </span>
        </div>
        <h1 className="max-w-[24ch] font-display text-5xl leading-[1.02] tracking-tight text-balance sm:text-6xl">
          {content.title}
        </h1>
        <ReviewProgress
          size="lg"
          intervalIndex={content.interval_index}
          status={content.status}
          nextReviewDate={content.next_review_date}
          reviewLogs={cycleLogs.map((log) => ({
            intervalIndexAtReview: log.interval_index_at_review,
            reviewedAt: log.reviewed_at,
          }))}
          className="-mx-[2px]"
        />
        <ContentActions
          contentId={content.id}
          status={content.status}
          intervalIndex={content.interval_index}
          lastReviewedAt={content.last_reviewed_at}
          today={today}
        />
      </header>

      <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="mb-5 text-sm font-semibold">
            Ciclo de revisões
          </h2>
          <ol className="relative space-y-6 border-l border-border pl-7">
            <li className="relative">
              <span className="absolute top-1 -left-[34px] size-3 rounded-full bg-foreground ring-4 ring-background" />
              <p className="text-sm font-medium">Estudado</p>
              <p className="text-sm text-muted-foreground">
                {formatReviewDatePtBR(content.studied_at)}, {formatRelativeDayPtBR(content.studied_at, today)}
              </p>
            </li>
            {steps.map((step, index) => {
              const stage = index + 1;
              return (
                <li key={stage} className="relative">
                  <span
                    className={cn(
                      "absolute top-1 -left-[34px] size-3 rounded-full ring-4 ring-background",
                      step.kind === "next" && "bg-background outline-2 outline-primary",
                      (step.kind === "projected" || step.kind === "pending") && "bg-stage-0",
                    )}
                    style={step.kind === "done" ? { backgroundColor: `var(--stage-${stage})` } : undefined}
                  />
                  <p className={cn("text-sm font-medium", step.kind !== "done" && step.kind !== "next" && "text-muted-foreground")}>
                    Revisão {stage}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {INTERVALS[index]} {INTERVALS[index] === 1 ? "dia" : "dias"} depois
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {step.kind === "done" ? (
                      <>
                        Feita em {inSentence(step.date)}
                        {step.lateBy > 0 ? (
                          <span className="text-overdue"> ({step.lateBy} {step.lateBy === 1 ? "dia" : "dias"} de atraso)</span>
                        ) : null}
                      </>
                    ) : step.kind === "next" ? (
                      <span className={step.date < today ? "font-medium text-overdue" : "text-primary"}>
                        {step.date < today
                          ? `Atrasada desde ${inSentence(step.date)}`
                          : `${formatReviewDatePtBR(step.date)}, ${formatRelativeDayPtBR(step.date, today)}`}
                      </span>
                    ) : step.kind === "projected" ? (
                      `Prevista para ${inSentence(step.date)}`
                    ) : content.status === "archived" ? (
                      "Pausada (arquivado)"
                    ) : (
                      "Feita (data no histórico abaixo)"
                    )}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="space-y-10">
          <section aria-labelledby="notes-heading">
            <h2 id="notes-heading" className="mb-3 text-sm font-semibold">
              Anotações
            </h2>
            {content.notes ? (
              <p className="max-w-[65ch] text-[15px] leading-relaxed whitespace-pre-wrap text-foreground/90">
                {content.notes}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sem anotações.{" "}
                <Link href={`/contents/${content.id}/edit`} className="text-primary hover:underline">
                  Adicionar
                </Link>
              </p>
            )}
          </section>

          <section aria-labelledby="log-heading">
            <h2 id="log-heading" className="mb-3 text-sm font-semibold">
              Todas as revisões <span className="font-normal text-muted-foreground tabular">{logs.length}</span>
            </h2>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma revisão registrada ainda.</p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {[...logs].reverse().map((log) => (
                  <li key={log.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <span>Revisão {log.interval_index_at_review + 1}</span>
                    <span className="text-muted-foreground tabular">
                      {new Date(log.reviewed_at).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
