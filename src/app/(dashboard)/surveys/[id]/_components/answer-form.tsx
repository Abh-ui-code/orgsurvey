"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AnswerField, isAnswered } from "@/components/shared/answer-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDebounced } from "@/hooks/use-debounced";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";
import { cn } from "@/lib/utils";
import type { AnswerValue, SurveyDetail } from "@/types/survey";
import { useSaveDraft, useSubmitResponse } from "../_hooks/use-survey-actions";
import { commentsByQuestion, QuestionComments } from "./question-comments";
import { SectionedQuestions } from "./sectioned-questions";

const AUTOSAVE_MS = 1500;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The responder's form, built so a long survey is safe to do over several
 * sittings: answers are saved as a draft a moment after each change, a progress
 * bar shows what is left, and submitting first checks for missed required
 * questions (jumping to the first) and then asks for confirmation.
 */
export function AnswerForm({ survey }: { survey: SurveyDetail }) {
  const submit = useSubmitResponse(survey.id);
  const saveDraft = useSaveDraft(survey.id);

  // Resume from the saved draft; a returned survey resumes from what was submitted.
  const initial = Object.keys(survey.draft_answers).length > 0 ? survey.draft_answers : survey.answers;
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(initial);
  const [saved, setSaved] = useState<Record<string, AnswerValue>>(initial); // what the server holds
  const [showMissing, setShowMissing] = useState(false);
  const [confirm, setConfirm] = useState(false);
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
  const questions = survey.sections.flatMap((s) => s.questions);
  const required = questions.filter((q) => q.required);
  const missing = required.filter((q) => !isAnswered(answers[q.id]));
  const done = required.length - missing.length;
  const percent = required.length ? Math.round((done / required.length) * 100) : 100;

  function trySubmit() {
    if (missing.length > 0) {
      setShowMissing(true);
      document.getElementById(`q-${missing[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error(`${missing.length} required question${missing.length === 1 ? "" : "s"} still need${missing.length === 1 ? "s" : ""} an answer`);
      return;
    }
    setConfirm(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-ink">Your response</h2>
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
          const flagged = showMissing && q.required && !isAnswered(answers[q.id]);
          return (
            <li key={q.id} id={`q-${q.id}`} className={cn("space-y-2 border-b border-line px-5 py-4 last:border-b-0", flagged && "bg-rust-soft/40")}>
              <p className="text-sm text-ink">
                <span className="mr-1.5 font-mono-data text-xs text-ink-faint">Q{n}</span>
                {q.text} {q.required && <span className="text-rust">*</span>}
              </p>
              {q.hint && <p className="text-xs text-ink-faint">{q.hint}</p>}
              <QuestionComments comments={pinned[q.id]} />
              <AnswerField question={q} value={answers[q.id]} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} />
              {flagged && <p className="text-xs font-medium text-rust">This question needs an answer.</p>}
            </li>
          );
        }}
      />

      <Card className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <p className="text-xs text-ink-faint">Your reviewer sees your answers only after you submit.</p>
        <Button onClick={trySubmit} loading={submit.isPending}>
          Submit for review
        </Button>
      </Card>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Submit your response?"
        description={`It goes to ${survey.reviewer?.full_name ?? "the reviewer"} to review. You won't be able to change it unless they send it back.`}
        confirmLabel="Submit"
        loading={submit.isPending}
        onConfirm={() =>
          submit.mutate(answers, {
            onSuccess: () => {
              toast.success("Submitted for review");
              setConfirm(false);
            },
            onError: (e) => {
              toast.error((e as Error).message);
              setConfirm(false);
            },
          })
        }
      />
    </div>
  );
}
