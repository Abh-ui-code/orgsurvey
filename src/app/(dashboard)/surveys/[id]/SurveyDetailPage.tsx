"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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

  return (
    <div className="space-y-4">
      <SurveyHeader survey={s} isAdmin={isAdmin} />
      {!isDraft && s.description && <p className="text-sm text-ink-muted">{s.description}</p>}

      {isDraft ? (
        <>
          <p className="text-sm text-ink-muted">This survey is a draft. Only administrators can see it until it is published.</p>
          <SurveyBuilder survey={s} />
        </>
      ) : (
        <>
          {s.status !== "closed" && <WorkflowStepper survey={s} />}

          {s.is_overdue && s.waiting_on && (
            <div className="rounded-lg border border-rust/30 bg-rust-soft p-4 text-sm">
              <p className="font-medium text-rust">This survey is overdue</p>
              <p className="mt-1 text-ink">
                It has been with {s.waiting_on.person.full_name} ({s.waiting_on.role}) {sinceText(daysSince(s.stage_since))}.
                {isAdmin && " You can move the due date or swap the person under People & deadline."}
              </p>
            </div>
          )}
          {s.status === "returned" && lastReturn && (
            <div className="rounded-lg border border-rust/30 bg-rust-soft p-4 text-sm">
              <p className="font-medium text-rust">Returned by {lastReturn.by?.full_name ?? "someone"}</p>
              {lastReturn.comment && <p className="mt-1 text-ink">{lastReturn.comment}</p>}
            </div>
          )}
          {s.status === "closed" && (
            <div className="rounded-lg border border-line bg-paper-sunken p-4 text-sm">
              <p className="font-medium text-ink">Closed{lastClose?.by ? ` by ${lastClose.by.full_name}` : ""}</p>
              {lastClose?.comment && <p className="mt-1 text-ink-muted">{lastClose.comment}</p>}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              {canRespond ? (
                <AnswerForm survey={s} />
              ) : responded ? (
                <AnswersReadOnly survey={s} />
              ) : (
                <Card>
                  <CardContent>
                    <p className="text-sm text-ink-muted">
                      {s.status === "closed" ? "This survey was closed before it was answered." : `Waiting for ${s.responder?.full_name ?? "the responder"} to respond.`}
                    </p>
                  </CardContent>
                </Card>
              )}
              {canReview && <DecisionPanel survey={s} role="reviewer" />}
              {canApprove && <DecisionPanel survey={s} role="approver" />}
            </div>

            <div className="space-y-4 self-start">
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
