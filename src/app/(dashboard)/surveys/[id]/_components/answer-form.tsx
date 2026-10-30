"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AnswerField, formatAnswer, isAnswered } from "@/components/shared/answer-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QuestionStatusBadge } from "@/components/ui/status-badge";
import { useDebounced } from "@/hooks/use-debounced";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";
import { cn } from "@/lib/utils";
import type { AnswerValue, SurveyDetail } from "@/types/survey";
import { useSaveDraft, useSubmitResponse } from "../_hooks/use-survey-actions";
import { commentsByQuestion, QuestionComments } from "./question-comments";
import { SectionedQuestions } from "./sectioned-questions";

const AUTOSAVE_MS = 1500;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const OPEN = ["awaiting_response", "returned"];

/**
 * The respondent's form for the questions assigned to them, built so a long
 * list is safe to do over several sittings: answers are saved as a draft a
 * moment after each change, a progress bar shows what is left, and submitting
 * first checks for missed required questions (jumping to the first) and then
 * asks for confirmation. Questions already submitted stay visible, read-only,
 * with where they are in review.
 */
export function AnswerForm({ survey, meId }: { survey: SurveyDetail; meId: string }) {
  const submit = useSubmitResponse(survey.id);
  const saveDraft = useSaveDraft(survey.id);

  const all = survey.sections.flatMap((s) => s.questions);
  const open = all.filter((q) => q.responder?.id === meId && OPEN.includes(q.status));
  const openIds = new Set(open.map((q) => q.id));
  // Resume from the saved draft; a returned question resumes from what was submitted.
  const initial = Object.fromEntries(
    open.flatMap((q) => {
      const value = survey.draft_answers[q.id] ?? survey.answers[q.id];
      return value === undefined ? [] : [[q.id, value] as const];
    }),
  ) as Record<string, AnswerValue>;
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(initial);
  const [saved, setSaved] = useState<Record<string, AnswerValue>>(initial); // what the server holds
  const [showMissing, setShowMissing] = useState(false);
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null); // questions awaiting confirmation
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const dirty = !same(answers, saved);
  useUnsavedChangesWarning(dirty);

  // Autosave once typing pauses. If something changes while a save is in
  // flight, `round` bumps when it finishes so the effect runs again and the
  // newest answers are never left behind.
  const settled = useDebounced(answers, AUTOSAVE_MS);
  const inFlight = useRef(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (same(settled, saved) || inFlight.current) return;
    inFlight.current = true;
    saveDraft.mutate(settled, {
      onSuccess: () => {
        setSaved(settled);
        setSavedAt(new Date());
      },
      onSettled: () => {
        inFlight.current = false;
        setRound((r) => r + 1);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, round]);

  const pinned = commentsByQuestion(survey.history, "responder");
  const required = open.filter((q) => q.required);
  const missing = required.filter((q) => !isAnswered(answers[q.id]));
  const done = required.length - missing.length;
  const percent = required.length ? Math.round((done / required.length) * 100) : 100;

  // GRI sections can be submitted partially. Any other section is submitted as
  // a whole: once something in it is answered, all its questions must be.
  // Sections left untouched stay open for later.
  const sections = survey.sections.map((section) => {
    const mine = section.questions.filter((q) => openIds.has(q.id));
    const started = mine.some((q) => isAnswered(answers[q.id]));
    const incomplete = !section.gri && started && mine.some((q) => !isAnswered(answers[q.id]));
    return { mine, started, incomplete };
  });
  const ready = sections.filter((s) => s.started && !s.incomplete).flatMap((s) => s.mine.filter((q) => isAnswered(answers[q.id])));
  const incompleteIds = new Set(sections.filter((s) => s.incomplete).flatMap((s) => s.mine.map((q) => q.id)));

  function trySubmit(ids: string[]) {
    if (incompleteIds.size > 0) {
      setShowMissing(true);
      const first = open.find((q) => incompleteIds.has(q.id) && !isAnswered(answers[q.id]));
      document.getElementById(`q-${first?.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Answer every question in a section you started, or clear it, before submitting");
      return;
    }
    if (ids.length === 0) {
      toast.error("Answer at least one section to submit");
      return;
    }
    setConfirmIds(ids);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Your questions</h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            {open.length} to answer{all.length > open.length ? ` · ${all.length - open.length} already submitted` : ""}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-ink-faint" aria-live="polite">
          {saveDraft.isPending ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </>
          ) : dirty ? (
            "Unsaved changes"
          ) : savedAt ? (
            <>
              <Check className="h-3 w-3 text-moss" /> Draft saved
            </>
          ) : (
            "Saved automatically as you go"
          )}
        </span>
      </div>

      {survey.instructions && (
        <div className="rounded-md border border-brand/30 bg-brand-soft px-3 py-2 text-sm text-brand-strong">
          <span className="font-semibold">Instructions: </span>
          {survey.instructions}
        </div>
      )}

      {required.length > 0 && (
        <Card className="sticky top-0 z-10 px-5 py-3">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="text-ink-muted">{percent === 100 ? "All required questions answered" : `${done} of ${required.length} required answered`}</span>
            <span className={cn("font-mono-data font-semibold", percent === 100 ? "text-moss" : "text-brand-strong")}>{percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-paper-sunken">
            <div className={cn("h-full rounded-full transition-all duration-500", percent === 100 ? "bg-moss" : "bg-brand")} style={{ width: `${percent}%` }} />
          </div>
        </Card>
      )}

      <SectionedQuestions
        survey={survey}
        render={(q, n) => {
          if (!openIds.has(q.id)) {
            const answer = formatAnswer(survey.answers[q.id]);
            return (
              <li key={q.id} className="space-y-1 border-b border-line bg-paper-sunken/40 px-5 py-3 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-ink">
                    <span className="mr-1.5 font-mono-data text-xs text-ink-faint">Q{n}</span>
                    {q.text}
                  </p>
                  <QuestionStatusBadge status={q.status} />
                </div>
                <p className="whitespace-pre-wrap text-sm font-medium text-ink-muted">{answer && answer !== "—" ? answer : "No answer"}</p>
                <QuestionComments comments={pinned[q.id]} />
              </li>
            );
          }
          const flagged = showMissing && incompleteIds.has(q.id) && !isAnswered(answers[q.id]);
          return (
            <li key={q.id} id={`q-${q.id}`} className={cn("space-y-2 border-b border-line px-5 py-4 last:border-b-0", flagged && "bg-rust-soft/40")}>
              <p className="text-sm text-ink">
                <span className="mr-1.5 font-mono-data text-xs text-ink-faint">Q{n}</span>
                {q.text} {q.required && <span className="text-rust">*</span>}
              </p>
              {q.hint && <p className="text-xs text-ink-faint">{q.hint}</p>}
              <QuestionComments comments={pinned[q.id]} />
              <AnswerField question={q} value={answers[q.id]} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} />
              {flagged && <p className="text-xs font-medium text-rust">Answer this to submit the section.</p>}
            </li>
          );
        }}
      />

      <Card className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <p className="text-xs text-ink-faint">Your reviewer sees these answers only after you submit.</p>
        <Button onClick={() => trySubmit(ready.map((q) => q.id))} loading={submit.isPending} disabled={ready.length === 0 && incompleteIds.size === 0}>
          Submit {ready.length} question{ready.length === 1 ? "" : "s"} for review
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmIds !== null}
        onOpenChange={(o) => !o && setConfirmIds(null)}
        title={`Submit ${confirmIds?.length ?? 0} question${confirmIds?.length === 1 ? "" : "s"}?`}
        description={`They go to ${survey.reviewer?.full_name ?? "the reviewer"} to review. You won't be able to change them unless they are sent back.${confirmIds && open.length - confirmIds.length > 0 ? ` ${open.length - confirmIds.length} other question${open.length - confirmIds.length === 1 ? "" : "s"} will stay open for you.` : ""}`}
        confirmLabel="Submit"
        loading={submit.isPending}
        onConfirm={() => {
          const ids = confirmIds ?? [];
          submit.mutate({ answers, questionIds: ids }, {
            onSuccess: () => {
              toast.success(`${ids.length} question${ids.length === 1 ? "" : "s"} submitted for review`);
              setConfirmIds(null);
            },
            onError: (e) => {
              toast.error((e as Error).message);
              setConfirmIds(null);
            },
          });
        }}
      />
    </div>
  );
}
