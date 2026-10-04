import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getContentById } from "@/lib/data/contents";
import { EditContentForm } from "@/components/edit-content-form";

export const metadata: Metadata = { title: "Editar" };

export default async function EditContentPage(props: PageProps<"/contents/[id]/edit">) {
  const { id } = await props.params;
  const supabase = await createClient();

  const content = await getContentById(supabase, id);
  if (!content) notFound();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8 lg:py-12">
      <Link
        href={`/contents/${content.id}`}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Voltar
      </Link>
      <h1 className="font-display text-5xl leading-none tracking-tight">Editar conteúdo</h1>
      <EditContentForm content={content} />
    </main>
  );
}
