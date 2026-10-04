"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NewContentForm } from "@/components/new-content-form";

export function NewContentDialog({
  open,
  onOpenChange,
  subjects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: string[];
}) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal">O que você estudou?</DialogTitle>
          <DialogDescription>
            A primeira revisão fica marcada para o dia seguinte ao estudo.
          </DialogDescription>
        </DialogHeader>
        <NewContentForm
          subjects={subjects}
          onSuccess={() => {
            onOpenChange(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
