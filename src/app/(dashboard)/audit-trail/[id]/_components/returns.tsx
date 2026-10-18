import { CheckCircle2 } from "lucide-react";
import { formatAnswer } from "@/components/shared/answer-field";
import { Avatar } from "@/components/shared/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";
import type { SurveyDetail } from "@/types/survey";
import { ACTION_META } from "../../../surveys/[id]/_components/activity-card";
import { AUDIENCE_LABEL } from "../../../surveys/[id]/_components/question-comments";
import { numberQuestions, roleOf } from "../../_lib";

/** Every time questions were sent back or commented on: who, to whom, why, and for
 * each flagged question what the answer was at that moment next to the comment. */
export function Returns({ survey }: { survey: SurveyDetail }) {
  const returns = survey.history.filter((h) => h.action === "returned" || h.question_comments.length > 0);
  const questions = numberQuestions(survey);

  if (returns.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={CheckCircle2}
          title="Nothing sent back or commented on"
          description={survey.status === "approved" ? "It went through without a single return." : "Nobody has returned or commented on a question so far."}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {returns.map((event, i) => {
        const returned = event.action === "returned";
        // The answers being judged: the latest submission of that question before this step.
        const sentFor = (questionId: string) =>
          survey.history.filter((h) => h.action === "submitted" && h.question_ids.includes(questionId) && new Date(h.at) <= new Date(event.at)).pop();
        return (
          <Card key={event.id} className="overflow-hidden">
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-5 py-3 ${returned ? "bg-rust-soft/40" : "bg-brand-soft/40"}`}>
              <span className="font-display text-base font-semibold text-ink">{returned ? `Return ${returns.slice(0, i + 1).filter((r) => r.action === "returned").length}` : ACTION_META[event.action].label}</span>
              <Badge tone={returned ? "rust" : "brand"}>{returned ? (event.audience ? AUDIENCE_LABEL[event.audience] : "Returned") : "Comment"}</Badge>
              <span className="text-xs text-ink-muted">
                {event.question_ids.length} question{event.question_ids.length === 1 ? "" : "s"}
              </span>
              <span className="ml-auto text-xs text-ink-faint">{formatDateTime(event.at)}</span>
            </div>
            <div className="space-y-4 px-5 py-4">
              {event.by && (
                <div className="flex items-center gap-2">
                  <Avatar name={event.by.full_name} className="h-7 w-7" />
                  <span className="text-sm font-medium text-ink">{event.by.full_name}</span>
                  <span className="rounded bg-paper-sunken px-1.5 py-0.5 text-2xs font-medium text-ink-muted">{roleOf(survey, event.by)}</span>
                </div>
              )}
              {event.comment && <p className="whitespace-pre-wrap rounded-md bg-paper-sunken px-3 py-2 text-sm text-ink">{event.comment}</p>}
              {event.question_comments.length > 0 ? (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {event.question_comments.map((c) => {
                    const q = questions.get(c.question_id);
                    const sent = sentFor(c.question_id);
                    const answer = sent ? formatAnswer(sent.snapshot[c.question_id]) : "";
                    return (
                      <li key={c.id} className="grid gap-3 px-4 py-3 md:grid-cols-2">
                        <div>
                          <p className="text-sm text-ink">
                            <span className="mr-1.5 font-mono-data text-xs text-ink-faint">Q{q?.n ?? "?"}</span>
                            {q?.question.text ?? "Question removed"}
                          </p>
                          {sent && c.question_id in sent.snapshot && (
                            <p className="mt-1.5 text-xs text-ink-muted">
                              Answer given: <span className="font-medium text-ink">{answer && answer !== "—" ? answer : "No answer"}</span>
                            </p>
                          )}
                        </div>
                        <p className={`whitespace-pre-wrap border-l-2 pl-3 text-sm text-ink ${returned ? "border-rust" : "border-brand"}`}>{c.text}</p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-ink-faint">No comments on individual questions.</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
