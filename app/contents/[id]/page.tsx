import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContentById, getReviewLogs } from "@/lib/data/contents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentActions } from "@/components/content-actions";

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  mastered: "Dominado",
  archived: "Arquivado",
};

export default async function ContentDetailPage(props: PageProps<"/contents/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();

  const content = await getContentById(supabase, id);
  if (!content) notFound();

  const logs = await getReviewLogs(supabase, id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{content.title}</CardTitle>
          {content.subject ? (
            <p className="text-sm text-muted-foreground">{content.subject}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {content.notes ? <p className="text-sm whitespace-pre-wrap">{content.notes}</p> : null}
          <p className="text-sm text-muted-foreground">
            Status: {STATUS_LABELS[content.status] ?? content.status}
          </p>
          <p className="text-sm text-muted-foreground">
            {content.next_review_date
              ? `Próxima revisão: ${content.next_review_date}`
              : "Sem revisão agendada"}
          </p>
          <ContentActions contentId={content.id} status={content.status} />
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
