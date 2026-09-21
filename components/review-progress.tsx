import { cn } from "cn";

const TOTAL_REVIEWS = 5;

export function ReviewProgress({
  intervalIndex,
  status,
  className,
}: {
  intervalIndex: number;
  status: string;
  className?: string;
}) {
  const completed = status === "mastered" ? TOTAL_REVIEWS : intervalIndex;

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      aria-label={`${completed} de ${TOTAL_REVIEWS} revisões concluídas`}
    >
      {Array.from({ length: TOTAL_REVIEWS }, (_, i) => i + 1).map((n) => {
        const done = n <= completed;
        return (
          <span
            key={n}
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-xs font-medium transition-all duration-300 ease-out",
              done
                ? "scale-100 bg-primary text-primary-foreground"
                : "scale-90 bg-muted text-muted-foreground",
            )}
          >
            {n}
          </span>
        );
      })}
    </div>
  );
}
