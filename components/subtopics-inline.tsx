import { cn } from "cn";

// Compact, single-line view of a content's subtopics for list rows
// ("page · limit · skip · offset"). Renders nothing for contents without
// subtopics, so older rows keep their exact look.
export function SubtopicsInline({
  subtopics,
  className,
}: {
  subtopics: string[];
  className?: string;
}) {
  if (subtopics.length === 0) return null;

  const text = subtopics.join(" · ");
  return (
    <p className={cn("truncate text-xs text-muted-foreground", className)} title={text}>
      {text}
    </p>
  );
}
