import { CheckCheck, CircleCheck, CirclePlus, Rocket, Send, Undo2, XCircle, type LucideIcon } from "lucide-react";
import { formatDateTime, questionRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HistoryAction, SurveyDetail } from "@/types/survey";
import { AUDIENCE_LABEL } from "./question-comments";

export const ACTION_META: Record<HistoryAction, { label: string; icon: LucideIcon; tone: string }> = {
  created: { label: "Created", icon: CirclePlus, tone: "bg-slate-soft text-slate" },
  published: { label: "Published and assigned", icon: Rocket, tone: "bg-brand-soft text-brand-strong" },
  submitted: { label: "Answers submitted", icon: Send, tone: "bg-brand-soft text-brand-strong" },
  reviewed: { label: "Passed review", icon: CheckCheck, tone: "bg-moss-soft text-moss" },
  approved: { label: "Approved", icon: CircleCheck, tone: "bg-moss-soft text-moss" },
  returned: { label: "Returned to respondent", icon: Undo2, tone: "bg-rust-soft text-rust" },
  closed: { label: "Closed", icon: XCircle, tone: "bg-slate-soft text-slate" },
};

/** The survey's activity log as a horizontal timeline, newest first, shown
 * inside the progress card. Each step that was about particular questions says
 * which. */
export function ActivityTimeline({ survey }: { survey: SurveyDetail }) {
  const items = [...survey.history].reverse();
  const numbers = new Map(survey.sections.flatMap((s) => s.questions).map((q) => [q.id, q.number]));
  if (items.length === 0) return null;
  return (
    <div className="border-t border-line pt-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">Activity</div>
        <span className="text-xs text-ink-faint">{items.length} event{items.length === 1 ? "" : "s"}</span>
      </div>
      <ol className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {items.map((h, i) => {
          const m = ACTION_META[h.action];
          const nums = h.question_ids.map((id) => numbers.get(id) ?? 0).filter(Boolean);
          return (
            <li key={h.id} className="relative min-w-[230px] flex-1 basis-0 rounded-lg border border-line bg-paper-sunken/50 p-3 text-sm">
              <div className="flex items-start gap-2.5">
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", m.tone)}>
                  <m.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium text-ink">
                    <span className="truncate">{h.action === "returned" && h.audience ? AUDIENCE_LABEL[h.audience] : m.label}</span>
                    {i === 0 && items.length > 1 && <span className="rounded bg-brand-soft px-1.5 py-0.5 text-2xs font-semibold text-brand-strong">Latest</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {h.by?.full_name ?? "Unknown"} · {formatDateTime(h.at)}
                  </p>
                </div>
              </div>
              {nums.length > 0 && (
                <p className="mt-2 text-xs text-ink-muted">
                  <span className="font-mono-data font-medium text-ink">{questionRange(nums)}</span>
                  {" · "}
                  {nums.length} question{nums.length === 1 ? "" : "s"}
                </p>
              )}
              {h.comment && <p className="mt-1.5 line-clamp-2 text-xs italic text-ink-muted">“{h.comment}”</p>}
              {h.question_comments.length > 0 && (
                <p className="mt-1 text-xs text-ink-faint">
                  {h.question_comments.length} question note{h.question_comments.length === 1 ? "" : "s"}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
