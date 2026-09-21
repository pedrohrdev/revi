"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createContent } from "@/app/contents/actions";
import { todaySaoPaulo } from "@/lib/date";

const ERROR_MESSAGES: Record<string, string> = {
  title_required: "Informe um título.",
  studied_at_invalid: "Data de estudo inválida.",
  studied_at_future: "A data de estudo não pode ser no futuro.",
  not_authenticated: "Sua sessão expirou. Faça login novamente.",
  create_failed: "Não foi possível salvar. Tente novamente.",
};

export function NewContentForm({ onSuccess }: { onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition();
  const today = todaySaoPaulo();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createContent({
        title: String(formData.get("title") ?? ""),
        subject: String(formData.get("subject") ?? "") || null,
        notes: String(formData.get("notes") ?? "") || null,
        studiedAt: String(formData.get("studiedAt") ?? today),
      });

      if (!result.ok) {
        toast.error(ERROR_MESSAGES[result.error] ?? "Não foi possível salvar.");
        return;
      }

      toast.success("Conteúdo criado!");
      onSuccess();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required placeholder="Ex: Termodinâmica cap. 3" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Matéria (opcional)</Label>
        <Input id="subject" name="subject" placeholder="Ex: Física" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" name="notes" placeholder="Anotações sobre o que foi estudado" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="studiedAt">Data de estudo</Label>
        {/* max evita datas futuras como conveniência de UX — a
            validação de verdade é feita pela Server Action. */}
        <Input
          id="studiedAt"
          name="studiedAt"
          type="date"
          defaultValue={today}
          max={today}
          required
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
