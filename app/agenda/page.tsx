import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { BookOpenIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAllContents, getAllReviewLogs } from "@/lib/data/contents";
import {
  WEEKDAY_SHORT_PT,
  addDaysToDateString,
  addMonths,
  formatMonthPtBR,
  formatRelativeDayPtBR,
  formatReviewDatePtBR,
  isValidDateString,
  isValidMonthString,
  todaySaoPaulo,
  weekdayIndex,
} from "@/lib/date";
import { buildActivity, projectSchedule, type ActivityEvent, type ScheduledReview } from "@/lib/insights";
import { PageContainer, PageHeader } from "@/components/page-header";
import { SubjectTag } from "@/components/subject-tag";

export const metadata: Metadata = { title: "Agenda" };

interface DayInfo {
  scheduled: ScheduledReview[];
  projected: ScheduledReview[];
  reviewed: ActivityEvent[];
  studied: ActivityEvent[];
}

function emptyDay(): DayInfo {
  return { scheduled: [], projected: [], reviewed: [], studied: [] };
}

export default async function AgendaPage(props: PageProps<"/agenda">) {
  const params = await props.searchParams;
  const today = todaySaoPaulo();
  const dParam = typeof params.d === "string" ? params.d : undefined;
  const mParam = typeof params.m === "string" ? params.m : undefined;
  const selected = isValidDateString(dParam) ? dParam : today;
  const month = isValidMonthString(mParam) ? mParam : selected.slice(0, 7);

  const supabase = await createClient();
  const [contents, logs] = await Promise.all([getAllContents(supabase), getAllReviewLogs(supabase)]);

  const days = new Map<string, DayInfo>();
  const dayOf = (date: string) => {
    let info = days.get(date);
    if (!info) {
      info = emptyDay();
      days.set(date, info);
    }
    return info;
  };

  for (const item of projectSchedule(contents)) {
    // Overdue reviews are shown on today, where they actually need doing.
    const date = !item.projected && item.date < today ? today : item.date;
    (item.projected ? dayOf(date).projected : dayOf(date).scheduled).push(item);
  }
  for (const event of buildActivity(contents, logs)) {
    (event.kind === "reviewed" ? dayOf(event.date).reviewed : dayOf(event.date).studied).push(event);
  }

  const firstOfMonth = `${month}-01`;
  const gridStart = addDaysToDateString(firstOfMonth, -weekdayIndex(firstOfMonth));
  const nextMonthFirst = `${addMonths(month, 1)}-01`;
  const cells: string[] = [];
  for (let date = gridStart; date < nextMonthFirst || cells.length % 7 !== 0; ) {
    cells.push(date);
    date = addDaysToDateString(date, 1);
  }

  const info = days.get(selected) ?? emptyDay();
  const isPast = selected < today;
  const nothing =
    info.scheduled.length + info.projected.length + info.reviewed.length + info.studied.length === 0;

  return (
    <PageContainer>
      <PageHeader
        title="Agenda"
        description="Quando revisar cada conteúdo, e o que você estudou e revisou em cada dia."
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label={`Calendário de ${formatMonthPtBR(month)}`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-3xl">{formatMonthPtBR(month)}</h2>
            <div className="flex items-center gap-1">
              <Link
                href={`/agenda?m=${addMonths(month, -1)}&d=${selected}`}
                aria-label="Mês anterior"
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <ChevronLeftIcon className="size-4" />
              </Link>
              <Link
                href="/agenda"
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                Hoje
              </Link>
              <Link
                href={`/agenda?m=${addMonths(month, 1)}&d=${selected}`}
                aria-label="Próximo mês"
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <ChevronRightIcon className="size-4" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-7 border-t border-l border-border text-xs">
            {WEEKDAY_SHORT_PT.map((name) => (
              <div
                key={name}
                className="border-r border-b border-border px-2 py-2 text-muted-foreground"
              >
                {name}
              </div>
            ))}
            {cells.map((date) => {
              const day = days.get(date);
              const inMonth = date.startsWith(month);
              const isToday = date === today;
              const isSelected = date === selected;
              const reviewCount = (day?.scheduled.length ?? 0) + (day?.projected.length ?? 0);
              const label = `${formatReviewDatePtBR(date)}${
                day
                  ? `: ${day.scheduled.length} agendadas, ${day.projected.length} previstas, ${day.reviewed.length} revisadas, ${day.studied.length} estudados`
                  : ""
              }`;

              return (
                <Link
                  key={date}
                  href={`/agenda?m=${month}&d=${date}`}
                  scroll={false}
                  aria-label={label}
                  aria-current={isSelected ? "date" : undefined}
                  className={cn(
                    "relative flex min-h-16 flex-col gap-1.5 border-r border-b border-border p-1.5 transition-colors outline-none hover:bg-secondary/60 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring sm:min-h-24 sm:p-2",
                    !inMonth && "bg-[repeating-linear-gradient(135deg,transparent_0_6px,#0b0b0c_6px_7px)] text-muted-foreground/40",
                    isSelected && "bg-secondary",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs tabular",
                      isToday && "bg-primary font-semibold text-primary-foreground",
                    )}
                  >
                    {Number(date.slice(8))}
                  </span>
                  {day ? (
                    <span className="flex flex-wrap items-center gap-1">
                      {day.scheduled.length > 0 ? (
                        <span className="rounded bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground tabular">
                          {day.scheduled.length}
                        </span>
                      ) : null}
                      {day.projected.length > 0 ? (
                        <span className="rounded px-1 text-[10px] leading-4 text-primary/80 ring-1 ring-primary/40 ring-inset tabular">
                          {day.projected.length}
                        </span>
                      ) : null}
                      {day.reviewed.length > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground tabular">
                          <CheckIcon className="size-3" />
                          {day.reviewed.length}
                        </span>
                      ) : null}
                      {day.studied.length > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground tabular">
                          <BookOpenIcon className="size-3" />
                          {day.studied.length}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  {reviewCount > 0 ? <span className="sr-only">{reviewCount} revisões</span> : null}
                </Link>
              );
            })}
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <li className="inline-flex items-center gap-1.5">
              <span className="rounded bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground">
                n
              </span>
              Revisões agendadas
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="rounded px-1 text-[10px] leading-4 text-primary/80 ring-1 ring-primary/40 ring-inset">
                n
              </span>
              Previstas, se tudo for revisado em dia
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckIcon className="size-3" />
              Revisadas
            </li>
            <li className="inline-flex items-center gap-1.5">
              <BookOpenIcon className="size-3" />
              Estudos registrados
            </li>
          </ul>
        </section>

        <aside aria-live="polite" className="lg:sticky lg:top-8 lg:self-start">
          <p className="text-sm text-muted-foreground">
            {selected === today ? "Hoje" : formatRelativeDayPtBR(selected, today)}
          </p>
          <h2 className="mb-6 font-display text-3xl">{formatReviewDatePtBR(selected)}</h2>

          {nothing ? (
            <p className="text-sm text-muted-foreground">
              {isPast ? "Nenhuma atividade registrada neste dia." : "Nenhuma revisão prevista para este dia."}
            </p>
          ) : (
            <div className="space-y-7">
              <DayGroup
                title={selected === today ? "Para revisar (inclui atrasadas)" : "Revisões agendadas"}
                items={info.scheduled.map((item) => ({
                  key: `${item.contentId}-${item.stage}`,
                  id: item.contentId,
                  title: item.title,
                  subject: item.subject,
                  meta: `Revisão ${item.stage}`,
                }))}
              />
              <DayGroup
                title="Previstas"
                hint="Acontecem neste dia se as revisões anteriores forem feitas em dia."
                items={info.projected.map((item) => ({
                  key: `${item.contentId}-${item.stage}`,
                  id: item.contentId,
                  title: item.title,
                  subject: item.subject,
                  meta: `Revisão ${item.stage}`,
                }))}
              />
              <DayGroup
                title="Revisado"
                items={info.reviewed.map((event) => ({
                  key: `${event.contentId}-r${event.stage}`,
                  id: event.contentId,
                  title: event.title,
                  subject: event.subject,
                  meta: `Revisão ${event.stage}`,
                }))}
              />
              <DayGroup
                title="Estudado"
                items={info.studied.map((event) => ({
                  key: `${event.contentId}-s`,
                  id: event.contentId,
                  title: event.title,
                  subject: event.subject,
                  meta: "Primeiro estudo",
                }))}
              />
            </div>
          )}
        </aside>
      </div>
    </PageContainer>
  );
}

function DayGroup({
  title,
  hint,
  items,
}: {
  title: string;
  hint?: string;
  items: { key: string; id: string; title: string; subject: string | null; meta: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="text-sm font-semibold">
        {title} <span className="font-normal text-muted-foreground tabular">{items.length}</span>
      </h3>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {items.map((item) => (
          <li key={item.key} className="py-2.5">
            <Link href={`/contents/${item.id}`} className="block truncate text-sm hover:underline">
              {item.title}
            </Link>
            <div className="mt-0.5 flex items-center gap-3 text-xs">
              <SubjectTag subject={item.subject} />
              <span className="text-muted-foreground">{item.meta}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
