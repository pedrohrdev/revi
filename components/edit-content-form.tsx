"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateContent } from "@/app/contents/actions";
import type { ContentRow } from "@/lib/data/contents";

const ERROR_MESSAGES: Record<string, string> = {
  title_required: "Informe um título.",
  not_authenticated: "Sua sessão expirou. Faça login novamente.",
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
      });

      if (!result.ok) {
        toast.error(ERROR_MESSAGES[result.error] ?? "Não foi possível salvar.");
        return;
      }

      toast.success("Conteúdo atualizado!");
      router.push(`/contents/${content.id}`);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required defaultValue={content.title} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Matéria (opcional)</Label>
        <Input id="subject" name="subject" defaultValue={content.subject ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" name="notes" defaultValue={content.notes ?? ""} />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
