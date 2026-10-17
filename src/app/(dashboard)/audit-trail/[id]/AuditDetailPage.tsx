"use client";

import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/permission-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SurveyStatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permissions";
import { useSurvey } from "@/hooks/use-surveys";
import { downloadFile } from "@/lib/api";
import { WorkflowStepper } from "../../surveys/[id]/_components/workflow-stepper";
import { daysInFlow } from "../_lib";
import { AnswersByRound } from "./_components/answers-by-round";
import { Journey } from "./_components/journey";
import { Returns } from "./_components/returns";

function Figure({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="px-5 py-4">
      <div className="font-display text-2xl font-semibold text-ink">{value}</div>
      <div className="mt-0.5 text-sm text-ink-muted">{label}</div>
      {hint && <div className="text-xs text-ink-faint">{hint}</div>}
    </div>
  );
}

function AuditDetail() {
  const { id } = useParams<{ id: string }>();
  const survey = useSurvey(id);
  const { user: me } = usePermissions();
  const [downloading, setDownloading] = useState(false);

  if (survey.isPending) return <Skeleton className="h-96 w-full" />;
  if (survey.isError || !survey.data) {
    return (
      <EmptyState
        title="Survey not found"
        description="It may have been removed."
        action={
          <Button asChild variant="secondary">
            <Link href="/audit-trail">Back to audit trail</Link>
          </Button>
        }
      />
    );
  }

  const s = survey.data;
  const returns = s.history.filter((h) => h.action === "returned");
  const notes = returns.reduce((sum, h) => sum + h.question_comments.length, 0);
  const days = daysInFlow(s);

  async function download() {
    setDownloading(true);
    try {
      await downloadFile(`/reports/surveys/${s.id}/audit/`, "survey-audit-trail.xlsx");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/audit-trail" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> All audit trails
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-ink">{s.title}</h1>
            <SurveyStatusBadge status={s.status} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {s.category.label} · {s.question_count} question{s.question_count === 1 ? "" : "s"} · {s.target_unit.name}
          </p>
        </div>
        <Button onClick={download} loading={downloading} disabled={s.status === "draft"}>
          <FileSpreadsheet className="h-4 w-4" /> Download Excel
        </Button>
      </div>

      {s.status === "draft" ? (
        <Card>
          <EmptyState title="Not published yet" description="The audit trail starts when the survey is published and handed to the respondent." />
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="px-5 py-4">
              <WorkflowStepper survey={s} meId={me?.id} />
            </CardContent>
          </Card>

          <Card className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 sm:divide-y-0">
            <Figure label="Days in the workflow" value={days ?? "—"} hint={s.status === "approved" || s.status === "closed" ? "From publishing to the end" : "From publishing until now"} />
            <Figure label="Times submitted" value={s.history.filter((h) => h.action === "submitted").length} />
            <Figure label="Times sent back" value={returns.length} hint={returns.length === 0 ? "No returns" : undefined} />
            <Figure label="Comments on questions" value={notes} />
          </Card>

          <Tabs defaultValue="journey">
            <TabsList>
              <TabsTrigger value="journey">Journey</TabsTrigger>
              <TabsTrigger value="returns">Returns & comments{returns.length > 0 && ` (${returns.length})`}</TabsTrigger>
              <TabsTrigger value="answers">Answers by round</TabsTrigger>
            </TabsList>
            <TabsContent value="journey">
              <Journey survey={s} />
            </TabsContent>
            <TabsContent value="returns">
              <Returns survey={s} />
            </TabsContent>
            <TabsContent value="answers">
              <AnswersByRound survey={s} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

export default function AuditDetailPage() {
  return (
    <PermissionGate module="audit_trail" featureName="the audit trail">
      <AuditDetail />
    </PermissionGate>
  );
}
