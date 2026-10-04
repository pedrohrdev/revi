"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon } from "lucide-react";
import { cn } from "cn";
import { markReviewed } from "@/app/contents/actions";

const ERROR_MESSAGES: Record<string, string> = {
  already_reviewed_today: "Esse conteúdo já foi revisado hoje.",
  content_not_active: "Esse conteúdo não pode ser revisado agora.",
};

export function MarkReviewedButton({
  contentId,
  intervalIndex,
  lastReviewedAt,
  today,
  className,
}: {
  contentId: string;
  intervalIndex: number;
  lastReviewedAt: string | null;
  today: string;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const alreadyReviewedToday = lastReviewedAt === today;

  function handleClick() {
    startTransition(async () => {
      const result = await markReviewed(contentId);
      if (!result.ok) {
        toast.error(ERROR_MESSAGES[result.error] ?? "Não foi possível marcar como revisado.");
        return;
      }
      toast.success(
        result.data.status === "mastered"
          ? "Ciclo completo. Conteúdo dominado!"
          : `Revisão ${intervalIndex + 1} registrada.`,
      );
      router.refresh();
    });
  }

  if (alreadyReviewedToday) {
    return (
      <span
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-primary",
          className,
        )}
      >
        <CheckIcon className="size-4" />
        Revisão {intervalIndex} feita
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-sm font-medium transition-colors hover:border-primary/60 hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60",
        className,
      )}
    >
      <CheckIcon className="size-4" />
      {isPending ? "Registrando…" : "Revisei"}
    </button>
  );
}
