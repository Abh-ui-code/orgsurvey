"use client";

import { Download, MessageSquarePlus, UserRoundCog } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatAnswer } from "@/components/shared/answer-field";
import { Avatar } from "@/components/shared/avatar";
import { PersonSelect } from "@/components/shared/person-select";
import { Button } from "@/components/ui/button";
import { QUESTION_STATUS, QuestionStatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { downloadCsv, slug } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { questionTypeLabel } from "@/types/question";
import { QUESTION_STATUSES, type QuestionStatus, type SurveyDetail } from "@/types/survey";
import { useAssignQuestions } from "../_hooks/use-survey-actions";
import { commentsByQuestion, QuestionComments } from "./question-comments";
import { SectionedQuestions } from "./sectioned-questions";

export type Choice = "pass" | "return";

/** Set when the reviewer or approver is deciding: which questions can be decided
 * (those at `status`), what is chosen for each, and the notes written beside answers. */
export interface Deciding {
  status: QuestionStatus;
  /** What each question is marked as; unmarked questions are left for later. */
  choices: Record<string, Choice>;
  onChoose: (ids: string[], choice: Choice | null) => void;
  /** Wording of the forward action: "Pass" for the reviewer, "Approve" for the approver. */
  passLabel: string;
  notes: Record<string, string>;
  onNote: (questionId: string, text: string) => void;
}

/** The questions with their answers as the reviewer, approver, administrator and
 * (once submitted) the respondent see them: who answered each, where it is, the
 * notes on it, and a CSV export. When `deciding` is given, each question waiting on
 * the person gets a checkbox and a box for a note. Administrators can hand a
 * question that has not been submitted to someone else. */
export function AnswersReadOnly({ survey, deciding, canReassign }: { survey: SurveyDetail; deciding?: Deciding; canReassign?: boolean }) {
  const past = commentsByQuestion(survey.history);
  const questions = survey.sections.flatMap((s) => s.questions);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<QuestionStatus | "all">("all");
  const [reassigning, setReassigning] = useState<string | null>(null);
  const assign = useAssignQuestions(survey.id);
  const several = new Set(questions.map((q) => q.responder?.id)).size > 1 || survey.respondents.length > 1;

  const counts = Object.fromEntries(QUESTION_STATUSES.map((s) => [s, questions.filter((q) => q.status === s).length])) as Record<QuestionStatus, number>;
  const actionable = deciding ? questions.filter((q) => q.status === deciding.status) : [];

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Survey", survey.title],
      ["Category", survey.category.label],
      ["Aimed at", survey.target_unit.name],
      ["Status", survey.status.replace("_", " ")],
      ["Reviewer", survey.reviewer?.full_name ?? ""],
      ["Approver", survey.approver?.full_name ?? ""],
      [],
      ["#", "Section", "Question", "Type", "Respondent", "Status", "Answer"],
    ];
    for (const section of survey.sections) {
      for (const q of section.questions) {
        rows.push([
          q.number,
          section.title,
          q.text,
          questionTypeLabel(q.type),
          q.responder?.full_name ?? "",
          QUESTION_STATUS[q.status].label,
          formatAnswer(survey.answers[q.id]),
        ]);
      }
    }
    downloadCsv(`${slug(survey.title)}-answers`, rows);
  }

  function reassign(questionId: string, personId: string) {
    assign.mutate([{ question_id: questionId, responder_id: personId || null }], {
      onSuccess: () => toast.success("Question reassigned"),
      onError: (e) => toast.error((e as Error).message),
      onSettled: () => setReassigning(null),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Questions &amp; answers</h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            {questions.length} question{questions.length === 1 ? "" : "s"} in view
            {deciding && actionable.length > 0 && ` · ${actionable.length} waiting on you`}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by stage">
        {(["all", ...QUESTION_STATUSES] as const)
          .filter((s) => s === "all" || counts[s] > 0)
          .map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={filter === s}
              onClick={() => setFilter(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === s ? "border-brand bg-brand-soft text-brand-strong" : "border-line text-ink-muted hover:bg-paper-sunken",
              )}
            >
              {s === "all" ? "All" : QUESTION_STATUS[s].short} <span className="ml-1 font-mono-data">{s === "all" ? questions.length : counts[s]}</span>
            </button>
          ))}
        {deciding && actionable.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 text-xs">
            <span className="text-ink-muted">Mark all {actionable.length} as</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                deciding.onChoose(
                  actionable.map((q) => q.id),
                  "pass",
                )
              }
            >
              {deciding.passLabel}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                deciding.onChoose(
                  actionable.map((q) => q.id),
                  "return",
                )
              }
            >
              Return
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                deciding.onChoose(
                  actionable.map((q) => q.id),
                  null,
                )
              }
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      <SectionedQuestions
        survey={survey}
        show={(q) => filter === "all" || q.status === filter}
        render={(q, n) => {
          const answer = formatAnswer(survey.answers[q.id]);
          const empty = !answer || answer === "—";
          const pickable = deciding?.status === q.status;
          const choice = deciding?.choices[q.id];
          const note = deciding?.notes[q.id] ?? "";
          const canMove = canReassign && (q.status === "awaiting_response" || q.status === "returned");
          return (
            <li
              key={q.id}
              className={cn("border-b border-line px-5 py-3 last:border-b-0", choice === "pass" && "bg-moss-soft/40", choice === "return" && "bg-rust-soft/40")}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <p className="text-sm text-ink">
                      <span className="mr-1.5 font-mono-data text-xs text-ink-faint">Q{n}</span>
                      {q.text}
                    </p>
                    <QuestionStatusBadge status={q.status} />
                  </div>
                  {several && q.responder && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                      <Avatar name={q.responder.full_name} className="h-4 w-4 text-2xs" /> {q.responder.full_name}
                      {canMove && (
                        <button
                          type="button"
                          onClick={() => setReassigning(reassigning === q.id ? null : q.id)}
                          className="ml-1 inline-flex items-center gap-1 font-medium text-brand hover:underline"
                        >
                          <UserRoundCog className="h-3.5 w-3.5" /> Reassign
                        </button>
                      )}
                    </p>
                  )}
                  {reassigning === q.id && (
                    <div className="mt-2 max-w-xs">
                      <PersonSelect
                        value={q.responder?.id ?? ""}
                        onChange={(id) => id && id !== q.responder?.id && reassign(q.id, id)}
                        disabledIds={[survey.reviewer?.id, survey.approver?.id].filter(Boolean) as string[]}
                      />
                    </div>
                  )}
                  <p className={empty ? "mt-1 text-sm italic text-ink-faint" : "mt-1 whitespace-pre-wrap text-sm font-medium text-ink"}>
                    {empty ? "No answer" : answer}
                  </p>
                  <QuestionComments comments={past[q.id]} />
                  {deciding && pickable && (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div
                          role="radiogroup"
                          aria-label={`Decision for question ${n}`}
                          className="inline-flex overflow-hidden rounded-md border border-line text-xs font-medium"
                        >
                          {(["pass", "return"] as const).map((c) => (
                            <button
                              key={c}
                              type="button"
                              role="radio"
                              aria-checked={choice === c}
                              onClick={() => deciding.onChoose([q.id], choice === c ? null : c)}
                              className={cn(
                                "px-3 py-1.5 transition-colors",
                                choice === c
                                  ? c === "pass"
                                    ? "bg-moss text-white"
                                    : "bg-rust text-white"
                                  : "bg-paper-raised text-ink-muted hover:bg-paper-sunken",
                                c === "return" && "border-l border-line",
                              )}
                            >
                              {c === "pass" ? deciding.passLabel : "Return"}
                            </button>
                          ))}
                        </div>
                        {!(open[q.id] || note || choice === "return") && (
                          <button
                            type="button"
                            onClick={() => setOpen({ ...open, [q.id]: true })}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-brand hover:bg-brand-soft"
                          >
                            <MessageSquarePlus className="h-3.5 w-3.5" /> Add comment
                          </button>
                        )}
                      </div>
                      {open[q.id] || note || choice === "return" ? (
                        <Textarea
                          rows={2}
                          value={note}
                          onChange={(e) => deciding.onNote(q.id, e.target.value)}
                          placeholder={choice === "return" ? "Why is it being returned? (sent to the respondent)" : "Note on this question (optional)"}
                          aria-label={`Note on question ${n}`}
                        />
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        }}
      />
    </div>
  );
}
