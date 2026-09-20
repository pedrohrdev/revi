import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAllByStatus, type ContentRow } from "@/lib/data/contents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function ContentListItem({ content }: { content: ContentRow }) {
  return (
    <Link href={`/contents/${content.id}`}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">{content.title}</CardTitle>
          {content.subject ? (
            <p className="text-sm text-muted-foreground">{content.subject}</p>
          ) : null}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {content.next_review_date
              ? `Próxima revisão: ${content.next_review_date}`
              : "Sem revisão agendada"}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function ContentList({
  contents,
  emptyMessage,
}: {
  contents: ContentRow[];
  emptyMessage: string;
}) {
  if (contents.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {contents.map((content) => (
        <ContentListItem key={content.id} content={content} />
      ))}
    </div>
  );
}

export default async function ContentsPage() {
  const supabase = await createClient();
  const [active, mastered, archived] = await Promise.all([
    getAllByStatus(supabase, "active"),
    getAllByStatus(supabase, "mastered"),
    getAllByStatus(supabase, "archived"),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4">
      <h1 className="text-2xl font-semibold">Conteúdos</h1>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Ativos ({active.length})</TabsTrigger>
          <TabsTrigger value="mastered">Dominados ({mastered.length})</TabsTrigger>
          <TabsTrigger value="archived">Arquivados ({archived.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <ContentList contents={active} emptyMessage="Nenhum conteúdo ativo." />
        </TabsContent>
        <TabsContent value="mastered">
          <ContentList contents={mastered} emptyMessage="Nenhum conteúdo dominado ainda." />
        </TabsContent>
        <TabsContent value="archived">
          <ContentList contents={archived} emptyMessage="Nenhum conteúdo arquivado." />
        </TabsContent>
      </Tabs>
    </main>
  );
}
