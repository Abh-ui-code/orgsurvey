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
import { daysSince, pluralDays } from "@/lib/format";
import { LIVE_STATUSES, roleName, type HistoryEntry } from "@/types/survey";
import { ActivityCard } from "./_components/activity-card";
import { AnswerForm } from "./_components/answer-form";
import { AnswersReadOnly, type Choice, type Deciding } from "./_components/answers-read-only";
import { SurveyBuilder } from "./_components/builder/survey-builder";
import { DecisionPanel } from "./_components/decision-panel";
import { LiveAssignmentCard } from "./_components/live-assignment-card";
import { RespondentsCard } from "./_components/respondents-card";
import { SurveyHeader } from "./_components/survey-header";
import { WorkflowStepper } from "./_components/workflow-stepper";

const lastOf = (history: HistoryEntry[], action: HistoryEntry["action"]) => [...history].reverse().find((h) => h.action === action);
const OPEN = ["awaiting_response", "returned"];

export default function SurveyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const survey = useSurvey(id);
  const { user: me, isAdmin } = usePermissions();
  // What the reviewer or approver has ticked, and the notes pinned to questions.
  const [choices, setChoices] = useState<Record<string, Choice>>({});
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
  const questions = s.sections.flatMap((sec) => sec.questions);
  const mine = questions.filter((q) => q.responder?.id === me?.id);
  const canRespond = isLive && mine.some((q) => OPEN.includes(q.status));
  const isReviewer = isLive && me?.id === s.reviewer?.id;
  const isApprover = isLive && me?.id === s.approver?.id;
  const decidingRole = isReviewer ? "reviewer" : isApprover ? "approver" : null;
  const waitingStatus = isReviewer ? "awaiting_review" : "awaiting_approval";
  const waiting = decidingRole ? questions.filter((q) => q.status === waitingStatus) : [];
  const returnedMine = mine.filter((q) => q.status === "returned");
  const lastReturn = lastOf(s.history, "returned");
  const lastClose = lastOf(s.history, "closed");

  const choose = (ids: string[], choice: Choice | null) =>
    setChoices((prev) => {
      const next = { ...prev };
      for (const qid of ids) {
        if (choice) next[qid] = choice;
        else delete next[qid];
      }
      return next;
    });
  const deciding: Deciding | undefined =
    decidingRole && waiting.length > 0
      ? { status: waitingStatus, choices, onChoose: choose, passLabel: isReviewer ? "Pass" : "Approve", notes, onNote: (qid, text) => setNotes((n) => ({ ...n, [qid]: text })) }
      : undefined;

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
          {s.status !== "closed" && questions.length > 0 && (
            <Card>
              <CardContent className="px-5 py-4">
                <WorkflowStepper survey={s} meId={me?.id} />
              </CardContent>
            </Card>
          )}

          {s.is_overdue && s.waiting_on.length > 0 && (
            <Banner tone="rust" title="This survey is overdue">
              Still waiting on {s.waiting_on.slice(0, 3).map((w) => `${w.person.full_name} (${w.count} to ${w.role === "responder" ? "answer" : roleName(w.role)})`).join(", ")}
              {s.waiting_on.length > 3 && ` and ${s.waiting_on.length - 3} more`}; nothing has moved for {pluralDays(daysSince(s.stage_since))}.
              {isAdmin && " You can move the due date or reassign questions below."}
            </Banner>
          )}
          {returnedMine.length > 0 && lastReturn && (
            <Banner tone="rust" title={`${returnedMine.length} of your question${returnedMine.length === 1 ? " was" : "s were"} returned`}>
              {lastReturn.by && `by ${lastReturn.by.full_name}. `}
              {lastReturn.comment || "See the notes on the questions below."}
            </Banner>
          )}
          {s.status === "closed" && (
            <Banner tone="slate" title={`Closed${lastClose?.by ? ` by ${lastClose.by.full_name}` : ""}`}>
              {lastClose?.comment}
            </Banner>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              {canRespond && me ? (
                <AnswerForm survey={s} meId={me.id} />
              ) : questions.length > 0 ? (
                <AnswersReadOnly survey={s} deciding={deciding} canReassign={isAdmin && isLive} />
              ) : (
                <Card>
                  <EmptyState
                    title="Nothing to show yet"
                    description={
                      s.status === "closed"
                        ? "This survey was closed before any question reached you."
                        : isReviewer
                          ? "Questions appear here as soon as their respondents submit them."
                          : isApprover
                            ? "Questions appear here once the reviewer passes them on."
                            : "Questions appear here once they are submitted."
                    }
                  />
                </Card>
              )}
              {deciding && decidingRole && (
                <DecisionPanel survey={s} role={decidingRole} choices={Object.fromEntries(waiting.filter((q) => choices[q.id]).map((q) => [q.id, choices[q.id]]))} waiting={waiting.length} notes={notes} onSent={() => { setChoices({}); setNotes({}); }} />
              )}
            </div>

            <div className="space-y-5 self-start lg:sticky lg:top-4">
              {isAdmin && isLive && (
                <LiveAssignmentCard key={`${s.reviewer?.id}${s.approver?.id}${s.due_date}`} survey={s} />
              )}
              <RespondentsCard survey={s} meId={me?.id} />
              <ActivityCard survey={s} />
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
