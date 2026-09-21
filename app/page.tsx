import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAllByStatus, getDueToday, type ContentRow } from "@/lib/data/contents";
import { todaySaoPaulo } from "@/lib/date";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkReviewedButton } from "@/components/mark-reviewed-button";
import { ReviewProgress } from "@/components/review-progress";

function ContentCard({ content, today }: { content: ContentRow; today: string }) {
  return (
    <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader>
        <CardTitle className="text-base">{content.title}</CardTitle>
        {content.subject ? (
          <p className="text-sm text-muted-foreground">{content.subject}</p>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ReviewProgress intervalIndex={content.interval_index} status={content.status} />
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Próxima revisão: {content.next_review_date ?? "—"}
          </p>
          <MarkReviewedButton
            contentId={content.id}
            intervalIndex={content.interval_index}
            lastReviewedAt={content.last_reviewed_at}
            today={today}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-secondary px-3 py-2.5 text-center">
      <span className="text-xl font-semibold text-primary">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const [dueToday, active, mastered] = await Promise.all([
    getDueToday(supabase),
    getAllByStatus(supabase, "active"),
    getAllByStatus(supabase, "mastered"),
  ]);
  const today = todaySaoPaulo();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-4 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Revi</h1>
        <Link href="/contents/new" className={buttonVariants()}>
          Novo conteúdo
        </Link>
      </div>

      <div className="flex gap-2">
        <StatPill label="Para hoje" value={dueToday.length} />
        <StatPill label="Ativos" value={active.length} />
        <StatPill label="Dominados" value={mastered.length} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Para revisar hoje</h2>
        {dueToday.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nada para revisar hoje.
          </p>
        ) : (
          <div className="space-y-3">
            {dueToday.map((content) => (
              <ContentCard key={content.id} content={content} today={today} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Todos os conteúdos ativos</h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum conteúdo cadastrado ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {active.map((content) => (
              <ContentCard key={content.id} content={content} today={today} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
