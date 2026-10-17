import { MessageSquare } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { HistoryEntry, QuestionComment, ReturnAudience } from "@/types/survey";

export interface PinnedComment extends QuestionComment {
  audience: ReturnAudience;
}

export const AUDIENCE_LABEL: Record<ReturnAudience, string> = {
  responder: "Returned to responder",
  reviewer: "Returned to reviewer",
  both: "Returned to responder and reviewer",
};

/** Every note pinned to a question in the survey's returns, grouped by
 * question and oldest first. `visibleTo` keeps only the returns that were
 * sent to that person (a "both" return counts for either). */
export function commentsByQuestion(history: HistoryEntry[], visibleTo?: "responder" | "reviewer"): Record<string, PinnedComment[]> {
  const grouped: Record<string, PinnedComment[]> = {};
  for (const h of history) {
    if (h.action !== "returned" || !h.audience) continue;
    if (visibleTo && h.audience !== "both" && h.audience !== visibleTo) continue;
    for (const c of h.question_comments) (grouped[c.question_id] ??= []).push({ ...c, audience: h.audience });
  }
  return grouped;
}

/** The notes on one question, shown under it. */
export function QuestionComments({ comments }: { comments?: PinnedComment[] }) {
  if (!comments?.length) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {comments.map((c) => (
        <li key={c.id} className="rounded-md border border-rust/30 bg-rust-soft px-3 py-2 text-xs text-rust">
          <p className="flex items-center gap-1.5 font-semibold">
            <MessageSquare className="h-3 w-3" />
            {c.by?.full_name ?? "Someone"} · {AUDIENCE_LABEL[c.audience]} · {formatDateTime(c.at)}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-ink">{c.text}</p>
        </li>
      ))}
    </ul>
  );
}
