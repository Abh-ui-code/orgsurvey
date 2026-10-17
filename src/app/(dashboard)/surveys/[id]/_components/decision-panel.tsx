"use client";

import { CheckCircle2, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ReturnAudience, SurveyDetail } from "@/types/survey";
import { useApproveSurvey, useReviewSurvey, type QuestionNotes } from "../_hooks/use-survey-actions";

const AUDIENCES: { value: ReturnAudience; label: string }[] = [
  { value: "responder", label: "Responder" },
  { value: "reviewer", label: "Reviewer" },
  { value: "both", label: "Both" },
];

/** The decision panel shown to whoever the survey is currently waiting on:
 * the reviewer passes it or returns it to the responder; the approver approves
 * it or returns it to the responder, the reviewer or both. Notes pinned to
 * individual questions (kept by the page, written beside each answer) are
 * sent along with a return. */
export function DecisionPanel({
  survey,
  role,
  notes,
  onSent,
}: {
  survey: SurveyDetail;
  role: "reviewer" | "approver";
  notes: QuestionNotes;
  onSent: () => void;
}) {
  const review = useReviewSurvey(survey.id);
  const approve = useApproveSurvey(survey.id);
  const [comment, setComment] = useState("");
  const [audience, setAudience] = useState<ReturnAudience>("responder");
  const pending = review.isPending || approve.isPending;
  const noteCount = Object.values(notes).filter((t) => t.trim()).length;
  const done = {
    onSuccess: () => {
      toast.success("Decision recorded");
      setComment("");
      onSent();
    },
    onError: (e: Error) => toast.error(e.message),
  };

  const sendBack = () => {
    if (!comment.trim() && noteCount === 0) {
      toast.error("Add a comment, or a note on a question, explaining what to fix.");
      return;
    }
    if (role === "reviewer") review.mutate({ decision: "return", comment, notes }, done);
    else approve.mutate({ decision: "return", comment, notes, audience }, done);
  };
  // Question notes only travel with a return, so passing on clears none of them silently.
  const advance = () => (role === "reviewer" ? review.mutate({ decision: "pass", comment }, done) : approve.mutate({ decision: "approve", comment }, done));
  const returnLabel = role === "reviewer" ? "Return to responder" : `Return to ${audience === "both" ? "both" : audience}`;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle>{role === "reviewer" ? "Your review" : "Your approval"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-ink-muted">
          {role === "reviewer"
            ? "Check the response, then pass it on or send it back. Use Add comment under a question to flag a specific answer."
            : "Give final approval, or send it back. Use Add comment under a question to flag a specific answer."}
        </p>
        {role === "approver" && (
          <div role="radiogroup" aria-label="Return to" className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-muted">If returning, send to:</span>
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
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Comment (needed when returning, unless you've noted specific questions)"
        />
        {noteCount > 0 && (
          <p className="text-xs text-ink-faint">
            {noteCount} question note{noteCount === 1 ? "" : "s"} will be sent if you return it.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={pending} onClick={sendBack}>
            <Undo2 className="h-4 w-4" /> {returnLabel}
          </Button>
          <Button loading={pending} onClick={advance}>
            <CheckCircle2 className="h-4 w-4" />
            {role === "reviewer" ? "Pass to approver" : "Approve"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
