"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { formatAnswer } from "@/components/shared/answer-field";
import { Avatar } from "@/components/shared/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, questionRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HistoryEntry, SurveyDetail } from "@/types/survey";
import { ACTION_META } from "../../../surveys/[id]/_components/activity-card";
import { AUDIENCE_LABEL } from "../../../surveys/[id]/_components/question-comments";
import { gapText, numberQuestions, roleOf, splitSetup } from "../../_lib";
import { ByQuestion } from "./by-question";

/** The answer to a question as it stood at a step: the one submitted in that step, or
 * else the latest submission of that question before it. */
function answerAt(survey: SurveyDetail, questionId: string, event: HistoryEntry): string | undefined {
  const sent =
    event.action === "submitted"
      ? event
      : survey.history.filter((h) => h.action === "submitted" && h.question_ids.includes(questionId) && new Date(h.at) <= new Date(event.at)).pop();
  if (!sent) return undefined;
  const value = formatAnswer(sent.snapshot[questionId]);
  return value === "—" ? undefined : value;
}

/** How the question workflow stands, in words: the line under its heading. */
function outcome(survey: SurveyDetail): string {
  const { approved, total } = survey.question_stats;
  if (survey.status === "closed") return "Closed by an administrator";
  if (total === 0) return "No questions";
  if (approved === total) return `All ${total} questions approved`;
  return `${approved} of ${total} questions approved · in progress`;
}

/** The survey's whole path on one page. Setup first, then the question workflow,
 * which can be read two ways: **By question** (each question's complete trail: every
 * answer, what changed, each return, pass, approval and comment) or as a **Timeline** of
 * every step in order across all questions, narrowed to one respondent if wanted. */
export function Journey({ survey }: { survey: SurveyDetail }) {
  const [view, setView] = useState<"question" | "timeline">("question");
  const [who, setWho] = useState<string>("all");
  const { setup, flow } = splitSetup(survey.history);
  const questions = numberQuestions(survey);
  const respondent = survey.respondents.find((r) => r.person.id === who);
  const inScope = (event: HistoryEntry) =>
    !respondent || event.question_ids.length === 0 || event.question_ids.some((id) => respondent.question_ids.includes(id));
  const shown = flow.filter(inScope);
  let previous: HistoryEntry | null = null;

  const renderEvent = (event: HistoryEntry) => {
    const meta = ACTION_META[event.action];
    const gap = previous ? gapText(previous.at, event.at) : null;
    previous = event;
    const returned = event.action === "returned";
    // Cut to the chosen respondent's questions, so "50 of 100" reads as theirs.
    const ids = respondent ? event.question_ids.filter((id) => respondent.question_ids.includes(id)) : event.question_ids;
    const numbers = ids.map((id) => questions.get(id)?.n).filter((n): n is number => n !== undefined);
    const notes = respondent ? event.question_comments.filter((c) => ids.includes(c.question_id)) : event.question_comments;
    return (
      <li key={event.id} className="relative pb-5 pl-8 last:pb-0">
        <span className={cn("absolute -left-[17px] top-0 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-paper", meta.tone)}>
          <meta.icon className="h-4 w-4" />
        </span>
        {gap && <p className="-mt-1 mb-1.5 text-xs text-ink-faint">{gap}</p>}
        <div className={cn("rounded-lg border px-4 py-3", returned ? "border-rust/30 bg-rust-soft/50" : "border-line bg-paper-raised")}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-ink">{returned && event.audience ? AUDIENCE_LABEL[event.audience] : meta.label}</span>
            {returned && <Badge tone="rust">Sent back</Badge>}
            <span className="ml-auto text-xs text-ink-faint">{formatDateTime(event.at)}</span>
          </div>
          {event.by && (
            <div className="mt-2 flex items-center gap-2">
              <Avatar name={event.by.full_name} className="h-6 w-6 text-2xs" />
              <span className="text-sm text-ink">{event.by.full_name}</span>
              <span className="rounded bg-paper-sunken px-1.5 py-0.5 text-2xs font-medium text-ink-muted">{roleOf(survey, event.by)}</span>
            </div>
          )}
          {ids.length > 0 && (
            <QuestionChips
              ids={ids}
              numbers={numbers}
              total={survey.question_stats.total}
              survey={survey}
              tone={returned ? "rust" : "brand"}
              answerFor={(id) => answerAt(survey, id, event)}
            />
          )}
          {event.comment && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">“{event.comment}”</p>}
          {notes.length > 0 && (
            <ul className="mt-3 space-y-2">
              {notes.map((c) => {
                const q = questions.get(c.question_id);
                return (
                  <li key={c.id} className={cn("rounded-md border bg-paper-raised px-3 py-2", returned ? "border-rust/20" : "border-brand/20")}>
                    <p className="text-xs text-ink-muted">
                      <span className={cn("mr-1.5 font-mono-data font-semibold", returned ? "text-rust" : "text-brand-strong")}>Q{q?.n ?? "?"}</span>
                      {q?.question.text ?? "Question removed"}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{c.text}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-8">
      {setup.length > 0 && (
        <section aria-label="Setup">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
            <h3 className="font-display text-base font-semibold text-ink">Setup</h3>
            <span className="text-sm text-ink-muted">Created and handed to the respondents</span>
          </div>
          <ol className="relative ml-4 border-l-2 border-line">{setup.map(renderEvent)}</ol>
        </section>
      )}

      <section aria-label="Question workflow">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h3 className="font-display text-base font-semibold text-ink">Question workflow</h3>
            <span className="text-sm text-ink-muted">{outcome(survey)}</span>
          </div>
          <div
            role="radiogroup"
            aria-label="How to read the workflow"
            className="inline-flex overflow-hidden rounded-md border border-line text-xs font-medium"
          >
            {(
              [
                ["question", "By question"],
                ["timeline", "Timeline"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={view === value}
                onClick={() => setView(value)}
                className={cn(
                  "px-3 py-1.5 transition-colors",
                  view === value ? "bg-brand text-brand-contrast" : "bg-paper-raised text-ink-muted hover:bg-paper-sunken",
                  value === "timeline" && "border-l border-line",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {view === "question" ? (
          <>
            <p className="mb-3 text-xs text-ink-muted">
              Open a question to see everything that happened to it: each answer, what changed, every return, pass, approval and comment.
            </p>
            <ByQuestion survey={survey} />
          </>
        ) : (
          <>
            {survey.respondents.length > 1 && (
              <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Show steps for">
                <span className="text-xs text-ink-muted">Show steps for</span>
                {[
                  {
                    id: "all",
                    name: "Everyone",
                    count: survey.question_stats.total,
                  },
                  ...survey.respondents.map((r) => ({
                    id: r.person.id,
                    name: r.person.full_name,
                    count: r.stats.total,
                  })),
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={who === c.id}
                    onClick={() => setWho(c.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      who === c.id ? "border-brand bg-brand-soft text-brand-strong" : "border-line text-ink-muted hover:bg-paper-sunken",
                    )}
                  >
                    {c.name} <span className="ml-1 font-mono-data">{c.count}</span>
                  </button>
                ))}
              </div>
            )}
            {shown.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">
                {flow.length === 0 ? "Nobody has submitted any question yet." : "Nothing has happened to these questions yet."}
              </p>
            ) : (
              <ol className="relative ml-4 border-l-2 border-line">{shown.map(renderEvent)}</ol>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/** "50 of 100 questions · Q1–Q50", expandable to the questions themselves. */
function QuestionChips({
  ids,
  numbers,
  total,
  survey,
  tone,
  answerFor,
}: {
  ids: string[];
  numbers: number[];
  total: number;
  survey: SurveyDetail;
  tone: "brand" | "rust";
  /** The answer to show under each question: what was given at the time of this step. */
  answerFor?: (questionId: string) => string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const byId = new Map(survey.sections.flatMap((s) => s.questions).map((q) => [q.id, q]));
  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex max-w-full items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
          tone === "rust" ? "bg-rust-soft text-rust hover:bg-rust-soft/70" : "bg-brand-soft text-brand-strong hover:bg-brand-soft/70",
        )}
      >
        <span className="font-mono-data font-semibold">{ids.length}</span>
        <span>
          of {total} question{total === 1 ? "" : "s"}
        </span>
        <span className="truncate font-mono-data opacity-80">{questionRange(numbers)}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="mt-2 max-h-64 divide-y divide-line overflow-y-auto rounded-md border border-line bg-paper-raised">
          {ids.map((id) => {
            const q = byId.get(id);
            return (
              <li key={id} className="flex items-start gap-2 px-3 py-1.5 text-xs">
                <span className="w-9 shrink-0 font-mono-data font-semibold text-ink-faint">Q{q?.number ?? "?"}</span>
                <span className="min-w-0 flex-1 text-ink">
                  {q?.text ?? "Question removed"}
                  {answerFor && (
                    <span className="mt-0.5 block whitespace-pre-wrap font-medium text-brand-strong">
                      <span className="mr-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-faint">Answer</span>
                      {answerFor(id) ?? "No answer"}
                    </span>
                  )}
                </span>
                {q?.responder && <span className="shrink-0 text-ink-faint">{q.responder.full_name}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
