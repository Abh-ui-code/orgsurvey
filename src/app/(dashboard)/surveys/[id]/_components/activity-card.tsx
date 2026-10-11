import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { HistoryAction, HistoryEntry } from "@/types/survey";

const LABEL: Record<HistoryAction, string> = {
  created: "Created",
  published: "Published and assigned",
  submitted: "Response submitted",
  reviewed: "Passed review",
  approved: "Approved",
  returned: "Returned to responder",
  closed: "Closed",
};

/** The survey's activity log, newest first. */
export function ActivityCard({ history }: { history: HistoryEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {[...history].reverse().map((h) => (
            <li key={h.id} className="text-sm">
              <p className="font-medium text-ink">{LABEL[h.action]}</p>
              <p className="text-xs text-ink-faint">
                {h.by?.full_name ?? "Unknown"} · {formatDateTime(h.at)}
              </p>
              {h.comment && <p className="mt-1 text-ink-muted">“{h.comment}”</p>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
