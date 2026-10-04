import { cn } from "cn";
import { subjectColor } from "@/lib/insights";

export function SubjectTag({
  subject,
  className,
}: {
  subject: string | null | undefined;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-muted-foreground", className)}>
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: subjectColor(subject) }}
        aria-hidden
      />
      <span className="truncate">{subject?.trim() || "Sem matéria"}</span>
    </span>
  );
}
