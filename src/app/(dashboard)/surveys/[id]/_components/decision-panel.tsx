"use client";

import { CheckCircle2, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { roleName, type ReturnAudience, type SurveyDetail } from "@/types/survey";
import { useApproveSurvey, useReviewSurvey, type QuestionNotes } from "../_hooks/use-survey-actions";

const AUDIENCES: { value: ReturnAudience; label: string }[] = [
  { value: "responder", label: "Respondent" },
  { value: "reviewer", label: "Reviewer" },
  { value: "both", label: "Both" },
];

/** The decision panel for the reviewer or approver. Each question is marked Pass
 * (Approve) or Return in the list; one Submit sends them all, so a single visit can
 * return one question and pass two. Questions left unmarked wait for later. The
 * approver also chooses who returned questions go to. Notes written beside answers
 * travel with the decision on their question. */
export function DecisionPanel({
  survey,
  role,
  choices,
  waiting,
  notes,
  onSent,
}: {
  survey: SurveyDetail;
  role: "reviewer" | "approver";
  /** What each marked question is: "pass" or "return". */
  choices: Record<string, "pass" | "return">;
  /** How many questions are waiting on this person in total. */
  waiting: number;
  notes: QuestionNotes;
  onSent: () => void;
}) {
  const review = useReviewSurvey(survey.id);
  const approve = useApproveSurvey(survey.id);
  const [comment, setComment] = useState("");
  const [audience, setAudience] = useState<ReturnAudience>("responder");
  const pending = review.isPending || approve.isPending;
  const passIds = Object.keys(choices).filter((id) => choices[id] === "pass");
  const returnIds = Object.keys(choices).filter((id) => choices[id] === "return");
  const count = passIds.length + returnIds.length;
  const notesFor = (ids: string[]) => Object.fromEntries(ids.filter((id) => notes[id]?.trim()).map((id) => [id, notes[id]]));
  const forward = role === "reviewer" ? "Pass" : "Approve";
  const returnLabel = role === "reviewer" ? "respondent" : audience === "both" ? "respondent and reviewer" : roleName(audience);

  async function submit() {
    const returnNotes = notesFor(returnIds);
    if (returnIds.length > 0 && !comment.trim() && Object.keys(returnNotes).length < returnIds.length) {
      toast.error("Say what to fix: write a note under each returned question, or a general comment.");
      return;
    }
    try {
      // Returns first, so a missing reason stops everything before anything moves on.
      if (returnIds.length > 0) {
        const base = { decision: "return" as const, comment, questionIds: returnIds, notes: returnNotes };
        if (role === "reviewer") await review.mutateAsync(base);
        else await approve.mutateAsync({ ...base, audience });
      }
      if (passIds.length > 0) {
        const base = { comment: returnIds.length > 0 ? "" : comment, questionIds: passIds, notes: notesFor(passIds) };
        if (role === "reviewer") await review.mutateAsync({ ...base, decision: "pass" });
        else await approve.mutateAsync({ ...base, decision: "approve" });
      }
      toast.success(
        [passIds.length > 0 && `${passIds.length} ${role === "reviewer" ? "passed" : "approved"}`, returnIds.length > 0 && `${returnIds.length} returned`].filter(Boolean).join(" · "),
      );
      setComment("");
      onSent();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card className="sticky bottom-4 z-10 shadow-lg">
      <CardHeader className="py-3">
        <CardTitle>{role === "reviewer" ? "Your review" : "Your approval"}</CardTitle>
        <span className="flex items-center gap-2 text-xs">
          {count === 0 ? (
            <span className="text-ink-faint">{waiting} waiting on you</span>
          ) : (
            <>
              {passIds.length > 0 && <span className="rounded bg-moss-soft px-2 py-0.5 font-semibold text-moss">{passIds.length} {forward.toLowerCase()}</span>}
              {returnIds.length > 0 && <span className="rounded bg-rust-soft px-2 py-0.5 font-semibold text-rust">{returnIds.length} return</span>}
              <span className="text-ink-faint">{waiting - count} left for later</span>
            </>
          )}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        {count === 0 ? (
          <p className="text-sm text-ink-muted">
            Mark each question <span className="font-medium text-ink">{forward}</span> or <span className="font-medium text-ink">Return</span>, in any mix, then submit once. Anything you leave unmarked stays waiting for you.
          </p>
        ) : (
          <>
            {role === "approver" && returnIds.length > 0 && (
              <div role="radiogroup" aria-label="Return to" className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink-muted">Send returned questions to:</span>
                {AUDIENCES.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    role="radio"
                    aria-checked={audience === a.value}
                    onClick={() => setAudience(a.value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      audience === a.value ? "border-brand bg-brand-soft text-brand-strong" : "border-line text-ink-muted hover:bg-paper-sunken",
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
            <Textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={returnIds.length > 0 ? "General comment on the returned questions (optional if each has a note)" : "General comment (optional)"}
            />
          </>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-faint">
            {returnIds.length > 0 ? `${returnIds.length} will go back to the ${returnLabel}. ` : ""}
            {passIds.length > 0 ? `${passIds.length} will ${role === "reviewer" ? "move on to the approver" : "be approved"}.` : ""}
          </p>
          <Button loading={pending} disabled={count === 0} onClick={submit}>
            {returnIds.length > 0 && passIds.length === 0 ? <Undo2 className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            Submit {count > 0 ? `${count} decision${count === 1 ? "" : "s"}` : "decisions"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
