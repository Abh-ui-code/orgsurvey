import { MessageSquare } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { HistoryEntry, QuestionComment, ReturnAudience } from "@/types/survey";

export interface PinnedComment extends QuestionComment {
  /** What the step was: "Returned to respondent", "Note when passed to the approver" ... */
  label: string;
  returned: boolean;
}

export const AUDIENCE_LABEL: Record<ReturnAudience, string> = {
  responder: "Returned to respondent",
  reviewer: "Returned to reviewer",
  both: "Returned to respondent and reviewer",
};

const STEP_LABEL: Partial<Record<HistoryEntry["action"], string>> = {
  reviewed: "Note when passed to the approver",
  approved: "Note on approval",
};

/** Every note pinned to a question, grouped by question and oldest first,
 * whether it came with a return or with a decision to move the question on.
 * `visibleTo` leaves out returns that were not sent to that person (a "both"
 * return counts for either). */
export function commentsByQuestion(history: HistoryEntry[], visibleTo?: "responder" | "reviewer"): Record<string, PinnedComment[]> {
  const grouped: Record<string, PinnedComment[]> = {};
  for (const h of history) {
    const returned = h.action === "returned";
    if (returned && visibleTo && h.audience && h.audience !== "both" && h.audience !== visibleTo) continue;
    const label = returned ? (h.audience ? AUDIENCE_LABEL[h.audience] : "Returned") : STEP_LABEL[h.action];
    if (!label) continue;
    for (const c of h.question_comments) (grouped[c.question_id] ??= []).push({ ...c, label, returned });
  }
  return grouped;
}

/** The notes on one question, shown under it. */
export function QuestionComments({ comments }: { comments?: PinnedComment[] }) {
  if (!comments?.length) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {comments.map((c) => (
        <li
          key={c.id}
          className={
            c.returned
              ? "rounded-md border border-rust/30 bg-rust-soft px-3 py-2 text-xs text-rust"
              : "rounded-md border border-brand/25 bg-brand-soft px-3 py-2 text-xs text-brand-strong"
          }
        >
          <p className="flex items-center gap-1.5 font-semibold">
            <MessageSquare className="h-3 w-3" />
            {c.by?.full_name ?? "Someone"} · {c.label} · {formatDateTime(c.at)}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-ink">{c.text}</p>
        </li>
      ))}
    </ul>
  );
}
