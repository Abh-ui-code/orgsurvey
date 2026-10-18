import { formatAnswer } from "@/components/shared/answer-field";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SurveyQuestion } from "@/types/question";
import type { HistoryEntry, SurveyDetail } from "@/types/survey";
import { ACTION_META } from "../../../surveys/[id]/_components/activity-card";
import { AUDIENCE_LABEL } from "../../../surveys/[id]/_components/question-comments";
import { roleOf } from "../../_lib";

/** One step in a question's life, with what the answer was and how it changed. */
export interface TrailStep {
  event: HistoryEntry;
  /** For a submission: which answer this is (1 = first), the answer, and the previous one. */
  revision?: number;
  answer?: string;
  previous?: string;
  changed?: boolean;
}

const display = (value: string) => (value && value !== "—" ? value : "No answer");

/** Every step that touched a question, in order, with each submission's answer
 * set against the one before it. */
export function trailOf(survey: SurveyDetail, question: SurveyQuestion): TrailStep[] {
  const steps: TrailStep[] = [];
  let revisions = 0;
  let last: string | undefined;
  for (const event of survey.history) {
    if (!event.question_ids.includes(question.id)) continue;
    if (event.action !== "submitted") {
      steps.push({ event });
      continue;
    }
    const answer = formatAnswer(event.snapshot[question.id]);
    revisions += 1;
    steps.push({ event, revision: revisions, answer, previous: last, changed: last !== undefined && last !== answer });
    last = answer;
  }
  return steps;
}

/** A one-line account of a question for its collapsed row: the answer now, what
 * it was before, how many times it was revised and sent back. */
export function trailSummary(steps: TrailStep[]): { answer?: string; was?: string; revisions: number; returns: number; notes: number } {
  const submissions = steps.filter((s) => s.revision);
  const latest = submissions[submissions.length - 1];
  const changedFrom = [...submissions].reverse().find((s) => s.changed);
  return {
    answer: latest?.answer,
    was: changedFrom?.previous,
    revisions: submissions.length,
    returns: steps.filter((s) => s.event.action === "returned").length,
    notes: steps.reduce((n, s) => n + s.event.question_comments.length, 0),
  };
}

/** The full trail of one question as a vertical timeline: each answer given (with
 * what it replaced), each return with its reason, each pass and approval, and every
 * comment on this question, with who did it and when. */
export function QuestionTrail({ survey, question }: { survey: SurveyDetail; question: SurveyQuestion }) {
  const steps = trailOf(survey, question);
  if (steps.length === 0) {
    return <p className="pl-1 text-sm text-ink-muted">Not submitted yet. {question.responder?.full_name ?? "The respondent"} hasn&apos;t answered this question.</p>;
  }
  return (
    <ol className="relative ml-3 border-l-2 border-line">
      {steps.map(({ event, revision, answer, previous, changed }) => {
        const meta = ACTION_META[event.action];
        const returned = event.action === "returned";
        const notes = event.question_comments.filter((c) => c.question_id === question.id);
        const title = revision ? (revision === 1 ? "Answer submitted" : `Answer resubmitted (revision ${revision})`) : returned && event.audience ? AUDIENCE_LABEL[event.audience] : meta.label;
        return (
          <li key={event.id} className="relative pb-4 pl-7 last:pb-0">
            <span className={cn("absolute -left-[13px] top-0 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-paper-raised", meta.tone)}>
              <meta.icon className="h-3 w-3" />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className={cn("text-sm font-semibold", returned ? "text-rust" : "text-ink")}>{title}</span>
              <span className="text-xs text-ink-muted">
                {event.by?.full_name} · {roleOf(survey, event.by)}
              </span>
              <span className="ml-auto text-xs text-ink-faint">{formatDateTime(event.at)}</span>
            </div>

            {revision !== undefined && answer !== undefined && (
              <div className="mt-1.5 space-y-1">
                <div className={cn("rounded-md border px-3 py-2 text-sm", changed ? "border-amber/40 bg-amber-soft" : "border-line bg-paper-sunken")}>
                  <span className="mb-0.5 block text-2xs font-semibold uppercase tracking-wider text-ink-faint">Answer</span>
                  <span className={cn("whitespace-pre-wrap font-medium", display(answer) === "No answer" ? "italic text-ink-faint" : "text-ink")}>{display(answer)}</span>
                </div>
                {changed && previous !== undefined && (
                  <p className="text-xs text-ink-muted">
                    Changed from <span className="font-medium text-ink line-through decoration-ink-faint">{display(previous)}</span> to{" "}
                    <span className="font-medium text-ink">{display(answer)}</span>
                  </p>
                )}
                {revision > 1 && !changed && <p className="text-xs text-ink-faint">Resubmitted without changing the answer.</p>}
              </div>
            )}

            {event.comment && <p className="mt-1.5 text-xs italic text-ink-muted">General comment: “{event.comment}”</p>}
            {notes.map((c) => (
              <p
                key={c.id}
                className={cn("mt-1.5 whitespace-pre-wrap border-l-2 py-0.5 pl-2.5 text-sm text-ink", returned ? "border-rust" : "border-brand")}
              >
                <span className="mr-1.5 text-xs font-medium text-ink-muted">{c.by?.full_name}:</span>
                {c.text}
              </p>
            ))}
          </li>
        );
      })}
    </ol>
  );
}
