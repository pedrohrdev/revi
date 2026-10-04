"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { ArchiveIcon, CheckIcon, PencilIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
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
      toast.success(`Revisão ${intervalIndex + 1} registrada.`);
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
      toast.success("Ciclo recomeçado. Primeira revisão amanhã.");
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

  const quiet = buttonVariants({ variant: "ghost", size: "lg" }) + " text-muted-foreground";

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-2">
      {status === "active" ? (
        alreadyReviewedToday ? (
          <span className="mr-2 inline-flex h-10 items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-primary">
            <CheckIcon className="size-4" />
            Revisão {intervalIndex} feita hoje
          </span>
        ) : (
          <Button onClick={handleMarkReviewed} disabled={isPending} className="mr-2 h-10 px-4 font-semibold">
            <CheckIcon />
            {isPending ? "Registrando…" : `Revisei (revisão ${intervalIndex + 1})`}
          </Button>
        )
      ) : null}
      <Link href={`/contents/${contentId}/edit`} className={quiet}>
        <PencilIcon />
        Editar
      </Link>
      {status === "active" ? (
        <Button onClick={handleArchive} disabled={isPending} variant="ghost" size="lg" className="text-muted-foreground">
          <ArchiveIcon />
          Arquivar
        </Button>
      ) : null}
      <Button onClick={handleReset} disabled={isPending} variant="ghost" size="lg" className="text-muted-foreground">
        <RotateCcwIcon />
        {status === "active" ? "Recomeçar ciclo" : "Voltar a revisar"}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger
          className={buttonVariants({ variant: "ghost", size: "lg" }) + " text-muted-foreground hover:text-destructive"}
          disabled={isPending}
        >
          <Trash2Icon />
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
