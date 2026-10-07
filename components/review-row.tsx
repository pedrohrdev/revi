import Link from "next/link";
import { cn } from "cn";
import { CircleAlertIcon } from "lucide-react";
import type { ContentRow } from "@/lib/data/contents";
import { daysBetween } from "@/lib/date";
import { MarkReviewedButton } from "@/components/mark-reviewed-button";
import { ReviewProgress } from "@/components/review-progress";
import { SubjectTag } from "@/components/subject-tag";
import { SubtopicsInline } from "@/components/subtopics-inline";

// One line of the "Hoje" queue: what to review, which review it is, how
// late it is, and the action — readable without opening the content.
export function ReviewRow({ content, today }: { content: ContentRow; today: string }) {
  const lateBy =
    content.status === "active" && content.next_review_date
      ? daysBetween(content.next_review_date, today)
      : 0;
  const reviewedToday = content.last_reviewed_at === today;

  return (
    <li
      className={cn(
        "group relative flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6",
        reviewedToday && "opacity-70",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <Link
          href={`/contents/${content.id}`}
          className="block truncate text-[15px] font-medium text-foreground underline-offset-4 hover:underline"
        >
          {content.title}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <SubjectTag subject={content.subject} />
          {!reviewedToday && content.status === "active" ? (
            <span className="text-muted-foreground">
              Revisão {content.interval_index + 1} de 5
            </span>
          ) : null}
          {!reviewedToday && lateBy > 0 ? (
            <span className="inline-flex items-center gap-1 font-medium text-overdue">
              <CircleAlertIcon className="size-3.5" />
              {lateBy === 1 ? "Atrasada 1 dia" : `Atrasada ${lateBy} dias`}
            </span>
          ) : null}
        </div>
        <SubtopicsInline subtopics={content.subtopics} />
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <ReviewProgress
          intervalIndex={content.interval_index}
          status={content.status}
          nextReviewDate={content.next_review_date}
        />
        <MarkReviewedButton
          contentId={content.id}
          intervalIndex={content.interval_index}
          lastReviewedAt={content.last_reviewed_at}
          today={today}
          className="sm:min-w-28 sm:justify-center"
        />
      </div>
    </li>
  );
}
