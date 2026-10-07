"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubtopicsField } from "@/components/subtopics-field";
import { createContent } from "@/app/contents/actions";
import { addDaysToDateString, todaySaoPaulo } from "@/lib/date";

const ERROR_MESSAGES: Record<string, string> = {
  title_required: "Informe um título.",
  studied_at_invalid: "Data de estudo inválida.",
  studied_at_future: "A data de estudo não pode ser no futuro.",
  not_authenticated: "Sua sessão expirou. Faça login novamente.",
  too_many_subtopics: "Use no máximo 20 subconteúdos.",
  subtopic_too_long: "Cada subconteúdo pode ter até 120 caracteres.",
  create_failed: "Não foi possível salvar. Tente novamente.",
};

export function NewContentForm({
  onSuccess,
  subjects = [],
}: {
  onSuccess: () => void;
  subjects?: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const today = todaySaoPaulo();
  const yesterday = addDaysToDateString(today, -1);
  const [studiedAt, setStudiedAt] = useState(today);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createContent({
        title: String(formData.get("title") ?? ""),
        subject: String(formData.get("subject") ?? "") || null,
        notes: String(formData.get("notes") ?? "") || null,
        subtopics: formData.getAll("subtopics").map(String),
        studiedAt: String(formData.get("studiedAt") ?? today),
      });

      if (!result.ok) {
        toast.error(ERROR_MESSAGES[result.error] ?? "Não foi possível salvar.");
        return;
      }

      toast.success("Estudo registrado. Primeira revisão agendada.");
      onSuccess();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Assunto</Label>
        <Input
          id="title"
          name="title"
          required
          autoFocus
          placeholder="Ex.: Leis de Newton"
          className="h-11 text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Matéria</Label>
        <Input
          id="subject"
          name="subject"
          list="subject-suggestions"
          placeholder="Ex.: Física"
          autoComplete="off"
          className="h-10"
        />
        <datalist id="subject-suggestions">
          {subjects.map((subject) => (
            <option key={subject} value={subject} />
          ))}
        </datalist>
      </div>

      <SubtopicsField />

      <div className="space-y-2">
        <Label htmlFor="studiedAt">Quando estudou</Label>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Hoje", value: today },
            { label: "Ontem", value: yesterday },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStudiedAt(option.value)}
              aria-pressed={studiedAt === option.value}
              className={cn(
                "h-9 rounded-lg border px-3 text-sm transition-colors",
                studiedAt === option.value
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
          {/* max evita datas futuras como conveniência de UX — a
              validação de verdade é feita pela Server Action. */}
          <Input
            id="studiedAt"
            name="studiedAt"
            type="date"
            value={studiedAt}
            onChange={(event) => setStudiedAt(event.target.value)}
            max={today}
            required
            className="h-9 w-auto flex-1 [color-scheme:dark]"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Anotações</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Pontos-chave, páginas, dúvidas que ficaram"
          className="min-h-20"
        />
      </div>

      <Button type="submit" disabled={isPending} className="h-11 w-full text-sm font-semibold">
        {isPending ? "Registrando…" : "Registrar estudo"}
      </Button>
    </form>
  );
}
