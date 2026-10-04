import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { BookOpenIcon, CheckIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAllContents, getAllReviewLogs } from "@/lib/data/contents";
import { formatRelativeDayPtBR, formatReviewDatePtBR, todaySaoPaulo } from "@/lib/date";
import { buildActivity, groupByDate } from "@/lib/insights";
import { PageContainer, PageHeader } from "@/components/page-header";
import { SubjectTag } from "@/components/subject-tag";

export const metadata: Metadata = { title: "Histórico" };

// Days of activity shown per page; "Mostrar dias anteriores" adds more.
const PAGE_DAYS = 21;

const FILTERS = [
  { value: "all", label: "Tudo" },
  { value: "studied", label: "Estudos" },
  { value: "reviewed", label: "Revisões" },
] as const;

function timeOf(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function HistoryPage(props: PageProps<"/history">) {
  const params = await props.searchParams;
  const filter = FILTERS.find((f) => f.value === params.tipo)?.value ?? "all";

  const supabase = await createClient();
  const [contents, logs] = await Promise.all([getAllContents(supabase), getAllReviewLogs(supabase)]);
  const today = todaySaoPaulo();

  const events = buildActivity(contents, logs).filter(
    (event) => filter === "all" || event.kind === filter,
  );
  const allGroups = groupByDate(events);
  const limitParam = Number(typeof params.dias === "string" ? params.dias : "");
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? limitParam : PAGE_DAYS;
  const groups = allGroups.slice(0, limit);

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Histórico"
        description="Dia a dia, o que você estudou pela primeira vez e o que revisou."
      />

      <nav aria-label="Filtrar histórico" className="flex gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/history" : `/history?tipo=${f.value}`}
            aria-current={filter === f.value ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              filter === f.value
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nada registrado ainda.
        </p>
      ) : (
        <ol className="space-y-10">
          {groups.map((group) => (
            <li key={group.date} className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
              <div className="sm:sticky sm:top-6 sm:self-start">
                <p className="font-display text-2xl leading-tight">{formatReviewDatePtBR(group.date)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatRelativeDayPtBR(group.date, today)}
                </p>
              </div>
              <ul className="relative space-y-1 border-l border-border">
                {group.items.map((event) => (
                  <li key={`${event.kind}-${event.contentId}-${event.stage ?? 0}`} className="relative pl-6">
                    <span
                      className={cn(
                        "absolute top-3 -left-[9px] flex size-[17px] items-center justify-center rounded-full ring-4 ring-background",
                        event.kind === "reviewed" ? "text-primary-foreground" : "bg-secondary text-foreground",
                      )}
                      style={
                        event.kind === "reviewed"
                          ? { backgroundColor: `var(--stage-${event.stage})` }
                          : undefined
                      }
                      aria-hidden
                    >
                      {event.kind === "reviewed" ? (
                        <CheckIcon className="size-2.5" />
                      ) : (
                        <BookOpenIcon className="size-2.5" />
                      )}
                    </span>
                    <Link
                      href={`/contents/${event.contentId}`}
                      className="block rounded-lg px-3 py-2 transition-colors hover:bg-card"
                    >
                      <p className="text-sm">
                        <span className="text-muted-foreground">
                          {event.kind === "reviewed" ? `Revisão ${event.stage} de ` : "Estudou "}
                        </span>
                        <span className="font-medium">{event.title}</span>
                      </p>
                      <div className="mt-0.5 flex items-center gap-3 text-xs">
                        <SubjectTag subject={event.subject} />
                        {event.at ? <span className="text-muted-foreground tabular">{timeOf(event.at)}</span> : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {allGroups.length > groups.length ? (
        <Link
          href={`/history?${new URLSearchParams({
            ...(filter === "all" ? {} : { tipo: filter }),
            dias: String(limit + PAGE_DAYS),
          })}`}
          scroll={false}
          className="self-start rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Mostrar dias anteriores
        </Link>
      ) : null}
    </PageContainer>
  );
}
