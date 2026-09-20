import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAllByStatus, getDueToday, type ContentRow } from "@/lib/data/contents";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkReviewedButton } from "@/components/mark-reviewed-button";

function ContentCard({ content }: { content: ContentRow }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{content.title}</CardTitle>
        {content.subject ? (
          <p className="text-sm text-muted-foreground">{content.subject}</p>
        ) : null}
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Próxima revisão: {content.next_review_date ?? "—"}
        </p>
        <MarkReviewedButton contentId={content.id} />
      </CardContent>
    </Card>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const [dueToday, active] = await Promise.all([
    getDueToday(supabase),
    getAllByStatus(supabase, "active"),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Revi</h1>
        <Link href="/contents/new" className={buttonVariants()}>
          Novo conteúdo
        </Link>
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
              <ContentCard key={content.id} content={content} />
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
              <ContentCard key={content.id} content={content} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
