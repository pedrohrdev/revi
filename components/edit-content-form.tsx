"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubtopicsField } from "@/components/subtopics-field";
import { updateContent } from "@/app/contents/actions";
import type { ContentRow } from "@/lib/data/contents";

const ERROR_MESSAGES: Record<string, string> = {
  title_required: "Informe um título.",
  not_authenticated: "Sua sessão expirou. Faça login novamente.",
  too_many_subtopics: "Use no máximo 20 subconteúdos.",
  subtopic_too_long: "Cada subconteúdo pode ter até 120 caracteres.",
  not_found: "Não foi possível encontrar esse conteúdo.",
  update_failed: "Não foi possível salvar. Tente novamente.",
  invalid_id: "Conteúdo inválido.",
};

export function EditContentForm({ content }: { content: ContentRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateContent(content.id, {
        title: String(formData.get("title") ?? ""),
        subject: String(formData.get("subject") ?? "") || null,
        notes: String(formData.get("notes") ?? "") || null,
        subtopics: formData.getAll("subtopics").map(String),
      });

      if (!result.ok) {
        toast.error(ERROR_MESSAGES[result.error] ?? "Não foi possível salvar.");
        return;
      }

      toast.success("Alterações salvas.");
      router.push(`/contents/${content.id}`);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Assunto</Label>
        <Input id="title" name="title" required defaultValue={content.title} className="h-11 text-base" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Matéria</Label>
        <Input id="subject" name="subject" defaultValue={content.subject ?? ""} className="h-10" />
      </div>

      <SubtopicsField defaultValue={content.subtopics} />

      <div className="space-y-2">
        <Label htmlFor="notes">Anotações</Label>
        <Textarea id="notes" name="notes" defaultValue={content.notes ?? ""} className="min-h-40" />
      </div>

      <Button type="submit" disabled={isPending} className="h-11 w-full font-semibold">
        {isPending ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}
