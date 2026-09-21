"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { archiveContent, deleteContent, markReviewed, resetContent } from "@/app/contents/actions";

const MARK_REVIEWED_ERRORS: Record<string, string> = {
  already_reviewed_today: "Esse conteúdo já foi revisado hoje.",
  content_not_active: "Esse conteúdo não pode ser revisado agora.",
};

export function ContentActions({
  contentId,
  status,
  intervalIndex,
  lastReviewedAt,
  today,
}: {
  contentId: string;
  status: string;
  intervalIndex: number;
  lastReviewedAt: string | null;
  today: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const alreadyReviewedToday = lastReviewedAt === today;

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
      router.refresh();
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
      router.refresh();
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
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteContent(contentId);
      if (!result.ok) {
        toast.error("Não foi possível excluir.");
        return;
      }
      toast.success("Conteúdo excluído.");
      router.push("/contents");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "active" ? (
        alreadyReviewedToday ? (
          <Button disabled variant="outline" className="text-primary">
            ✓ Revisão {intervalIndex} feita
          </Button>
        ) : (
          <Button onClick={handleMarkReviewed} disabled={isPending}>
            Marcar como revisado
          </Button>
        )
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
      <AlertDialog>
        <AlertDialogTrigger
          className={buttonVariants({ variant: "destructive" })}
          disabled={isPending}
        >
          Excluir
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conteúdo?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O conteúdo e todo o histórico de revisões serão
              apagados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isPending}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
