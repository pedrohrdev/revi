import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContentById, getReviewLogs } from "@/lib/data/contents";
import { todaySaoPaulo } from "@/lib/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentActions } from "@/components/content-actions";
import { ReviewProgress } from "@/components/review-progress";

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  mastered: "Dominado",
  archived: "Arquivado",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  active: "bg-accent text-accent-foreground",
  mastered: "bg-primary text-primary-foreground",
  archived: "bg-muted text-muted-foreground",
};

export default async function ContentDetailPage(props: PageProps<"/contents/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();

  const content = await getContentById(supabase, id);
  if (!content) notFound();

  const logs = await getReviewLogs(supabase, id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-xl">{content.title}</CardTitle>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[content.status] ?? "bg-muted text-muted-foreground"}`}
            >
              {STATUS_LABELS[content.status] ?? content.status}
            </span>
          </div>
          {content.subject ? (
            <p className="text-sm text-muted-foreground">{content.subject}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {content.notes ? <p className="text-sm whitespace-pre-wrap">{content.notes}</p> : null}
          <ReviewProgress intervalIndex={content.interval_index} status={content.status} />
          <p className="text-sm text-muted-foreground">
            {content.next_review_date
              ? `Próxima revisão: ${content.next_review_date}`
              : "Sem revisão agendada"}
          </p>
          <ContentActions
            contentId={content.id}
            status={content.status}
            intervalIndex={content.interval_index}
            lastReviewedAt={content.last_reviewed_at}
            today={todaySaoPaulo()}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de revisões</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma revisão registrada ainda.
            </p>
          ) : (
            <ul className="space-y-1">
              {logs.map((log) => (
                <li key={log.id} className="text-sm text-muted-foreground">
                  {new Date(log.reviewed_at).toLocaleString("pt-BR")}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
