import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAllContents, getAllReviewLogs } from "@/lib/data/contents";
import { formatRelativeDayPtBR, todaySaoPaulo } from "@/lib/date";
import { subjectColor, subjectStats } from "@/lib/insights";
import { PageContainer, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Matérias" };

export default async function SubjectsPage() {
  const supabase = await createClient();
  const [contents, logs] = await Promise.all([getAllContents(supabase), getAllReviewLogs(supabase)]);
  const today = todaySaoPaulo();
  const stats = subjectStats(contents, logs, today);

  return (
    <PageContainer>
      <PageHeader
        title="Matérias"
        description="Quanto de cada matéria já está consolidado, o que está pendente e há quanto tempo você não mexe nela."
      />

      {stats.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          As matérias aparecem aqui conforme você registra estudos.
        </p>
      ) : (
        <ul className="grid overflow-hidden rounded-2xl border border-border sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((stat) => {
            const name = stat.subject || "Sem matéria";
            const href = `/contents?s=${encodeURIComponent(stat.subject || "-")}&status=all`;
            const idleDays = stat.lastActivity
              ? formatRelativeDayPtBR(stat.lastActivity, today)
              : null;
            return (
              <li key={name} className="-mr-px -mb-px border-r border-b border-border">
                <Link
                  href={href}
                  className="flex h-full flex-col gap-5 p-6 transition-colors outline-none hover:bg-card focus-visible:bg-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: subjectColor(stat.subject) }}
                        aria-hidden
                      />
                      <span className="truncate font-display text-2xl">{name}</span>
                    </h2>
                    {stat.due > 0 ? (
                      <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                        {stat.due} para hoje
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted-foreground">
                      <span>Consolidação</span>
                      <span className="text-foreground tabular">{Math.round(stat.progress * 100)}%</span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-stage-0"
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(stat.progress * 100)}
                      aria-label={`Consolidação de ${name}`}
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(stat.progress > 0 ? 3 : 0, stat.progress * 100)}%` }}
                      />
                    </div>
                  </div>

                  <dl className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Assuntos</dt>
                      <dd className="mt-0.5 text-lg tabular">{stat.total}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Dominados</dt>
                      <dd className="mt-0.5 text-lg tabular">{stat.mastered}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Revisões</dt>
                      <dd className="mt-0.5 text-lg tabular">{stat.reviews}</dd>
                    </div>
                  </dl>

                  {idleDays ? (
                    <p className="mt-auto text-xs text-muted-foreground">
                      Última atividade: {idleDays}
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
