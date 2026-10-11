import { Badge } from "@/components/ui/badge";
import { daysUntil, formatDate, pluralDays } from "@/lib/format";
import { LIVE_STATUSES, type SurveyStatus } from "@/types/survey";

/** Days left that count as "due soon". */
const SOON_DAYS = 3;

/**
 * A due date, with urgency: red once overdue, amber when due within a few
 * days, plain otherwise. Only surveys still in progress get the urgency;
 * an approved or closed survey just shows its date.
 */
export function DueBadge({ dueDate, status, overdue }: { dueDate: string | null; status: SurveyStatus; overdue?: boolean }) {
  if (!dueDate) return <span className="text-ink-faint">No due date</span>;
  if (!LIVE_STATUSES.includes(status)) return <span>{formatDate(dueDate)}</span>;

  // The server's `overdue` and this browser's idea of "today" can differ by a
  // few hours (different time zones); either one saying it has passed counts.
  const left = daysUntil(dueDate);
  if (overdue || left < 0) {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <Badge tone="rust" dot>
          {left < 0 ? `Overdue ${pluralDays(Math.abs(left))}` : "Overdue"}
        </Badge>
        <span className="text-xs text-ink-faint">{formatDate(dueDate)}</span>
      </span>
    );
  }
  if (left <= SOON_DAYS) {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <Badge tone="amber" dot>
          {left === 0 ? "Due today" : `Due in ${pluralDays(left)}`}
        </Badge>
        <span className="text-xs text-ink-faint">{formatDate(dueDate)}</span>
      </span>
    );
  }
  return <span>{formatDate(dueDate)}</span>;
}
