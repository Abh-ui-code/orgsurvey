import { CheckCheck, CircleCheck, CirclePlus, Rocket, Send, Undo2, XCircle, type LucideIcon } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HistoryAction, HistoryEntry } from "@/types/survey";
import { AUDIENCE_LABEL } from "./question-comments";

export const ACTION_META: Record<HistoryAction, { label: string; icon: LucideIcon; tone: string }> = {
  created: { label: "Created", icon: CirclePlus, tone: "bg-slate-soft text-slate" },
  published: { label: "Published and assigned", icon: Rocket, tone: "bg-brand-soft text-brand-strong" },
  submitted: { label: "Response submitted", icon: Send, tone: "bg-brand-soft text-brand-strong" },
  reviewed: { label: "Passed review", icon: CheckCheck, tone: "bg-moss-soft text-moss" },
  approved: { label: "Approved", icon: CircleCheck, tone: "bg-moss-soft text-moss" },
  returned: { label: "Returned to respondent", icon: Undo2, tone: "bg-rust-soft text-rust" },
  closed: { label: "Closed", icon: XCircle, tone: "bg-slate-soft text-slate" },
};

/** The survey's activity log as a vertical timeline, newest first. */
export function ActivityCard({ history }: { history: HistoryEntry[] }) {
  const items = [...history].reverse();
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle>Activity</CardTitle>
        <span className="text-xs text-ink-faint">{items.length} events</span>
      </CardHeader>
      <ul>
        {items.map((h) => {
          const m = ACTION_META[h.action];
          return (
            <li key={h.id} className="flex gap-3 border-b border-line px-5 py-3 text-sm last:border-b-0">
              <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", m.tone)}>
                <m.icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-ink">{h.action === "returned" && h.audience ? AUDIENCE_LABEL[h.audience] : m.label}</p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {h.by?.full_name ?? "Unknown"} · {formatDateTime(h.at)}
                </p>
                {h.comment && <p className="mt-1.5 text-xs italic text-ink-muted">“{h.comment}”</p>}
                {h.question_comments.length > 0 && (
                  <p className="mt-1 text-xs text-ink-faint">
                    {h.question_comments.length} question note{h.question_comments.length === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
