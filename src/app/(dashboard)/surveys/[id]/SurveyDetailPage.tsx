"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/use-permissions";
import { useSurvey } from "@/hooks/use-surveys";
import { daysSince, sinceText } from "@/lib/format";
import { LIVE_STATUSES, type HistoryEntry } from "@/types/survey";
import { ActivityCard } from "./_components/activity-card";
import { AnswerForm } from "./_components/answer-form";
import { AnswersReadOnly } from "./_components/answers-read-only";
import { SurveyBuilder } from "./_components/builder/survey-builder";
import { DecisionPanel } from "./_components/decision-panel";
import { LiveAssignmentCard } from "./_components/live-assignment-card";
import { SurveyHeader } from "./_components/survey-header";
import { WorkflowStepper } from "./_components/workflow-stepper";

const lastOf = (history: HistoryEntry[], action: HistoryEntry["action"]) => [...history].reverse().find((h) => h.action === action);

export default function SurveyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const survey = useSurvey(id);
  const { user: me, isAdmin } = usePermissions();
  // Notes the reviewer or approver is pinning to questions before returning.
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (survey.isPending) return <Skeleton className="h-96 w-full" />;
  if (survey.isError || !survey.data) {
    return (
      <EmptyState
        title="Survey not found"
        description="It may have been removed, or you aren't involved in it."
        action={
          <Button asChild variant="secondary">
            <Link href="/surveys">Back to surveys</Link>
          </Button>
        }
      />
    );
  }

  const s = survey.data;
  const isDraft = s.status === "draft";
  const isLive = LIVE_STATUSES.includes(s.status);
  const canRespond = me?.id === s.responder?.id && (s.status === "awaiting_response" || s.status === "returned");
  const canReview = me?.id === s.reviewer?.id && s.status === "awaiting_review";
  const canApprove = me?.id === s.approver?.id && s.status === "awaiting_approval";
  const responded = s.history.some((h) => h.action === "submitted");
  const lastReturn = lastOf(s.history, "returned");
  const lastClose = lastOf(s.history, "closed");
  // An approver can send it back to the reviewer alone: the survey is back in review.
  const lastEvent = s.history[s.history.length - 1];
  const sentBackToReviewer = s.status === "awaiting_review" && lastEvent?.action === "returned" && lastEvent.audience === "reviewer";
  const deciding = canReview || canApprove;

  return (
    <div className="space-y-5">
      <SurveyHeader survey={s} isAdmin={isAdmin} />

      {isDraft ? (
        <>
          <Banner tone="slate" title="This survey is a draft">
            Only administrators can see it until it is published.
          </Banner>
          <SurveyBuilder survey={s} />
        </>
      ) : (
        <>
          {s.status !== "closed" && (
            <Card>
              <CardContent className="px-5 py-4">
                <WorkflowStepper survey={s} meId={me?.id} />
              </CardContent>
            </Card>
          )}

          {s.is_overdue && s.waiting_on && (
            <Banner tone="rust" title="This survey is overdue">
              It has been with {s.waiting_on.person.full_name} ({s.waiting_on.role}) {sinceText(daysSince(s.stage_since))}.
              {isAdmin && " You can move the due date or swap the person under People & deadline."}
            </Banner>
          )}
          {s.status === "returned" && lastReturn && (
            <Banner tone="rust" title={`Returned by ${lastReturn.by?.full_name ?? "someone"}`}>
              {lastReturn.audience === "both" && "(also sent to the reviewer) "}
              {lastReturn.comment || "See the notes on the questions below."}
            </Banner>
          )}
          {sentBackToReviewer && lastEvent && (
            <Banner tone="rust" title={`Returned to the reviewer by ${lastEvent.by?.full_name ?? "the approver"}`}>
              {lastEvent.comment || "See the notes on the questions below."}
            </Banner>
          )}
          {s.status === "closed" && (
            <Banner tone="slate" title={`Closed${lastClose?.by ? ` by ${lastClose.by.full_name}` : ""}`}>
              {lastClose?.comment}
            </Banner>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              {canRespond ? (
                <AnswerForm survey={s} />
              ) : responded ? (
                <AnswersReadOnly
                  survey={s}
                  notes={deciding ? notes : undefined}
                  onNote={deciding ? (id, text) => setNotes((n) => ({ ...n, [id]: text })) : undefined}
                />
              ) : (
                <Card>
                <EmptyState
                  title="No response yet"
                  description={s.status === "closed" ? "This survey was closed before it was answered." : `Waiting for ${s.responder?.full_name ?? "the responder"} to respond.`}
                />
                </Card>
              )}
              {canReview && <DecisionPanel survey={s} role="reviewer" notes={notes} onSent={() => setNotes({})} />}
              {canApprove && <DecisionPanel survey={s} role="approver" notes={notes} onSent={() => setNotes({})} />}
            </div>

            <div className="space-y-5 self-start lg:sticky lg:top-4">
              {isAdmin && isLive && (
                <LiveAssignmentCard key={`${s.responder?.id}${s.reviewer?.id}${s.approver?.id}${s.due_date}`} survey={s} />
              )}
              <ActivityCard history={s.history} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const BANNER = {
  rust: "border-rust/30 bg-rust-soft text-rust",
  slate: "border-line bg-paper-sunken text-ink-muted",
};

function Banner({ tone, title, children }: { tone: keyof typeof BANNER; title: string; children?: React.ReactNode }) {
  return (
    <div role="status" className={`rounded-md border px-3 py-2 text-sm ${BANNER[tone]}`}>
      <span className="font-semibold">{title}</span>
      {children && <span className="ml-1.5">{children}</span>}
    </div>
  );
}
