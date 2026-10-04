import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAllContents, getAllReviewLogs } from "@/lib/data/contents";
import {
  addDaysToDateString,
  formatRelativeDayPtBR,
  formatReviewDatePtBR,
  todaySaoPaulo,
  WEEKDAY_SHORT_PT,
  weekdayIndex,
} from "@/lib/date";
import {
  activityCounts,
  buildActivity,
  computeStreak,
  projectSchedule,
  splitQueue,
  upcomingLoad,
} from "@/lib/insights";
import { INTERVALS } from "@/lib/review";
import { PageContainer, SectionHeading } from "@/components/page-header";
import { ReviewRow } from "@/components/review-row";
import { LoadChart } from "@/components/load-chart";
import { SubjectTag } from "@/components/subject-tag";

// Longer queues fold the rest behind "Mostrar mais" so the page keeps
// its shape; overdue items come first, so the oldest are always visible.
const QUEUE_PREVIEW = 8;

function summary(overdue: number, dueToday: number, done: number): string {
  const pending = overdue + dueToday;
  if (pending === 0 && done > 0) return "Revisões de hoje concluídas. Bom trabalho.";
  if (pending === 0) return "Nenhuma revisão para hoje. Bom dia para estudar algo novo.";
  const main = pending === 1 ? "Você tem 1 revisão para hoje" : `Você tem ${pending} revisões para hoje`;
  if (overdue === 0) return `${main}.`;
  return `${main}, ${overdue === 1 ? "1 delas atrasada" : `${overdue} delas atrasadas`}.`;
}

function EmptyLibrary() {
  return (
    <section className="grid gap-10 border-t border-border pt-10 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-3">
        <h2 className="font-display text-3xl">Comece pelo que você estudou hoje.</h2>
        <p className="max-w-[48ch] text-muted-foreground">
          Registre o assunto e a matéria. O Revi agenda cinco revisões espaçadas e te avisa aqui no
          dia certo de cada uma. Use o botão “Registrar estudo” ou aperte N.
        </p>
      </div>
      <ol className="relative space-y-5 border-l border-border pl-6">
        <li className="relative">
          <span className="absolute top-1.5 -left-[29px] size-2.5 rounded-full bg-foreground" />
          <p className="text-sm font-medium">Dia do estudo</p>
          <p className="text-xs text-muted-foreground">Você registra o que estudou.</p>
        </li>
        {INTERVALS.map((days, i) => {
          const total = INTERVALS.slice(0, i + 1).reduce((sum, d) => sum + d, 0);
          return (
            <li key={days} className="relative">
              <span
                className="absolute top-1.5 -left-[29px] size-2.5 rounded-full"
                style={{ backgroundColor: `var(--stage-${i + 1})` }}
              />
              <p className="text-sm font-medium">Revisão {i + 1}</p>
              <p className="text-xs text-muted-foreground">
                {days === 1 ? "1 dia" : `${days} dias`} depois da anterior, cerca de {total}{" "}
                {total === 1 ? "dia" : "dias"} após o estudo
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const [contents, logs] = await Promise.all([getAllContents(supabase), getAllReviewLogs(supabase)]);
  const today = todaySaoPaulo();

  const queue = splitQueue(contents, today);
  const schedule = projectSchedule(contents);
  const loads = upcomingLoad(schedule, today, 14);
  const activity = buildActivity(contents, logs);
  const counts = activityCounts(activity);
  const streak = computeStreak(new Set(counts.keys()), today);
  const recentlyStudied = contents.slice(0, 5);
  const nextUp = schedule.find((item) => !item.projected && item.date > today);
  const last7 = Array.from({ length: 7 }, (_, i) => addDaysToDateString(today, i - 6));

  const pending = [...queue.overdue, ...queue.today];
  const pendingCount = pending.length;

  return (
    <PageContainer>
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">{formatReviewDatePtBR(today)}</p>
        <h1 className="max-w-[22ch] font-display text-5xl leading-[1.02] tracking-tight text-balance sm:text-6xl">
          {summary(queue.overdue.length, queue.today.length, queue.doneToday.length)}
        </h1>
      </header>

      {contents.length === 0 ? (
        <EmptyLibrary />
      ) : (
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-10">
            {pendingCount > 0 ? (
              <section aria-labelledby="queue-heading">
                <SectionHeading
                  title={<span id="queue-heading">Para revisar</span>}
                  aside={`${pendingCount} pendente${pendingCount === 1 ? "" : "s"}`}
                />
                <ul className="divide-y divide-border border-y border-border">
                  {pending.slice(0, QUEUE_PREVIEW).map((content) => (
                    <ReviewRow key={content.id} content={content} today={today} />
                  ))}
                </ul>
                {pending.length > QUEUE_PREVIEW ? (
                  <details className="group">
                    <summary className="cursor-pointer list-none py-3 text-sm text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">
                        Mostrar mais {pending.length - QUEUE_PREVIEW}
                      </span>
                      <span className="hidden group-open:inline">Mostrar menos</span>
                    </summary>
                    <ul className="divide-y divide-border border-b border-border">
                      {pending.slice(QUEUE_PREVIEW).map((content) => (
                        <ReviewRow key={content.id} content={content} today={today} />
                      ))}
                    </ul>
                  </details>
                ) : null}
              </section>
            ) : (
              <section className="rounded-2xl border border-border p-6">
                <p className="text-sm text-muted-foreground">
                  {nextUp
                    ? `Próxima revisão ${formatRelativeDayPtBR(nextUp.date, today)}: `
                    : "Nada agendado por enquanto."}
                  {nextUp ? (
                    <Link
                      href={`/contents/${nextUp.contentId}`}
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {nextUp.title}
                    </Link>
                  ) : null}
                </p>
              </section>
            )}

            {queue.doneToday.length > 0 ? (
              <section aria-labelledby="done-heading">
                <SectionHeading
                  title={<span id="done-heading">Revisado hoje</span>}
                  aside={queue.doneToday.length}
                />
                <ul className="divide-y divide-border border-y border-border">
                  {queue.doneToday.map((content) => (
                    <ReviewRow key={content.id} content={content} today={today} />
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="load-heading">
              <SectionHeading
                title={<span id="load-heading">Próximos 14 dias</span>}
                aside={
                  <Link href="/agenda" className="hover:text-foreground">
                    Abrir agenda
                  </Link>
                }
              />
              <div className="rounded-2xl border border-border p-5">
                <LoadChart loads={loads} />
              </div>
            </section>
          </div>

          <aside className="space-y-10">
            <section aria-labelledby="streak-heading">
              <SectionHeading title={<span id="streak-heading">Sequência</span>} />
              <div className="rounded-2xl border border-border p-5">
                <p className="flex items-baseline gap-2">
                  <span className="font-display text-6xl leading-none tabular">{streak.current}</span>
                  <span className="text-sm text-muted-foreground">
                    {streak.current === 1 ? "dia seguido" : "dias seguidos"}
                  </span>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {streak.activeToday
                    ? "Hoje já conta."
                    : streak.current > 0
                      ? "Estude ou revise algo hoje para manter."
                      : "Estude ou revise algo hoje para começar."}{" "}
                  Recorde: {streak.best} {streak.best === 1 ? "dia" : "dias"}.
                </p>
                <ol className="mt-5 grid grid-cols-7 gap-1.5" aria-label="Últimos 7 dias">
                  {last7.map((date) => {
                    const count = counts.get(date) ?? 0;
                    return (
                      <li key={date} className="flex flex-col items-center gap-1.5">
                        <span
                          className={`block h-8 w-full rounded-md ${count > 0 ? "bg-primary" : "bg-stage-0"}`}
                          title={`${formatReviewDatePtBR(date)}: ${count} atividade${count === 1 ? "" : "s"}`}
                        />
                        <span
                          className={`text-[10px] ${date === today ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                        >
                          {WEEKDAY_SHORT_PT[weekdayIndex(date)]}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </section>

            <section aria-labelledby="recent-heading">
              <SectionHeading
                title={<span id="recent-heading">Estudado recentemente</span>}
                aside={
                  <Link href="/history" className="hover:text-foreground">
                    Histórico
                  </Link>
                }
              />
              <ul className="space-y-3">
                {recentlyStudied.map((content) => (
                  <li key={content.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/contents/${content.id}`}
                        className="block truncate text-sm hover:underline"
                      >
                        {content.title}
                      </Link>
                      <SubjectTag subject={content.subject} className="text-xs" />
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeDayPtBR(content.studied_at, today)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      )}
    </PageContainer>
  );
}
