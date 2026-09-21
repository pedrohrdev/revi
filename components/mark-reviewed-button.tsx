"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
}: {
  contentId: string;
  intervalIndex: number;
  lastReviewedAt: string | null;
  today: string;
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
      toast.success("Revisão registrada!");
      router.refresh();
    });
  }

  if (alreadyReviewedToday) {
    return (
      <Button size="sm" variant="outline" disabled className="text-primary">
        ✓ Revisão {intervalIndex} feita
      </Button>
    );
  }

  return (
    <Button size="sm" onClick={handleClick} disabled={isPending}>
      {isPending ? "Marcando…" : "Marcar como revisado"}
    </Button>
  );
}
