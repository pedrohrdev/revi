"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { archiveContent, markReviewed, resetContent } from "@/app/contents/actions";

const MARK_REVIEWED_ERRORS: Record<string, string> = {
  already_reviewed_today: "Esse conteúdo já foi revisado hoje.",
  content_not_active: "Esse conteúdo não pode ser revisado agora.",
};

export function ContentActions({
  contentId,
  status,
}: {
  contentId: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleMarkReviewed() {
    startTransition(async () => {
      const result = await markReviewed(contentId);
      if (!result.ok) {
        toast.error(
          MARK_REVIEWED_ERRORS[result.error] ?? "Não foi possível marcar como revisado.",
        );
        return;
      }
      toast.success("Revisão registrada!");
    });
  }

  function handleArchive() {
    startTransition(async () => {
      const result = await archiveContent(contentId);
      if (!result.ok) {
        toast.error("Não foi possível arquivar.");
        return;
      }
      toast.success("Conteúdo arquivado.");
    });
  }

  function handleReset() {
    startTransition(async () => {
      const result = await resetContent(contentId);
      if (!result.ok) {
        toast.error("Não foi possível resetar.");
        return;
      }
      toast.success("Conteúdo reiniciado.");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "active" ? (
        <Button onClick={handleMarkReviewed} disabled={isPending}>
          Marcar como revisado
        </Button>
      ) : null}
      {status === "active" ? (
        <Button onClick={handleArchive} disabled={isPending} variant="outline">
          Arquivar
        </Button>
      ) : null}
      <Button onClick={handleReset} disabled={isPending} variant="outline">
        Resetar
      </Button>
      <Link
        href={`/contents/${contentId}/edit`}
        className={buttonVariants({ variant: "outline" })}
      >
        Editar
      </Link>
    </div>
  );
}
