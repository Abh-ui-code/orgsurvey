"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { SurveyDetail } from "@/types/survey";
import { useApproveSurvey, useReviewSurvey } from "../_hooks/use-survey-actions";

/** The decision panel shown to whoever the survey is currently waiting on:
 * the reviewer passes or returns it, the approver approves or returns it. */
export function DecisionPanel({ survey, role }: { survey: SurveyDetail; role: "reviewer" | "approver" }) {
  const review = useReviewSurvey(survey.id);
  const approve = useApproveSurvey(survey.id);
  const [comment, setComment] = useState("");
  const pending = review.isPending || approve.isPending;
  const done = {
    onSuccess: () => {
      toast.success("Decision recorded");
      setComment("");
    },
    onError: (e: Error) => toast.error(e.message),
  };

  const sendBack = () =>
    role === "reviewer" ? review.mutate({ decision: "return", comment }, done) : approve.mutate({ decision: "return", comment }, done);
  const advance = () =>
    role === "reviewer" ? review.mutate({ decision: "pass", comment }, done) : approve.mutate({ decision: "approve", comment }, done);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{role === "reviewer" ? "Your review" : "Your approval"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (required when returning to the responder)" />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={pending} onClick={sendBack}>
            Return to responder
          </Button>
          <Button loading={pending} onClick={advance}>
            {role === "reviewer" ? "Pass to approver" : "Approve"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
