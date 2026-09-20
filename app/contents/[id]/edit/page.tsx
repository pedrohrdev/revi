import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContentById } from "@/lib/data/contents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditContentForm } from "@/components/edit-content-form";

export default async function EditContentPage(props: PageProps<"/contents/[id]/edit">) {
  const { id } = await props.params;
  const supabase = await createClient();

  const content = await getContentById(supabase, id);
  if (!content) notFound();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col p-4">
      <Card>
        <CardHeader>
          <CardTitle>Editar conteúdo</CardTitle>
        </CardHeader>
        <CardContent>
          <EditContentForm content={content} />
        </CardContent>
      </Card>
    </main>
  );
}
