"use client";

import { ArrowLeft, Download, FileText } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PermissionGate } from "@/components/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useGriStandard } from "@/hooks/use-gri-standards";
import { GRI_SERIES, questionTypeLabel } from "@/types/question";

/** One GRI standard on its own page: what it is, its PDF, and its questions. */
function GriStandard() {
  const { id } = useParams<{ id: string }>();
  const standard = useGriStandard(id);
  const back = "/question-bank?category=gri";

  if (standard.isPending) return <Skeleton className="h-96 w-full" />;
  if (standard.isError || !standard.data) {
    return (
      <EmptyState
        icon={FileText}
        title="Standard not found"
        action={
          <Button asChild variant="secondary">
            <Link href={back}>Back to the question bank</Link>
          </Button>
        }
      />
    );
  }

  const s = standard.data;
  const series = GRI_SERIES.find((x) => x.value === s.series);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href={back} className="mb-2 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> GRI standards
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-ink">{`${s.code}: ${s.title}`}</h1>
            <Badge tone="brand">{s.edition}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {series?.label} · {s.question_count} question{s.question_count === 1 ? "" : "s"}
          </p>
        </div>
        <Button asChild>
          <a href={s.pdf} download>
            <Download className="h-4 w-4" /> Download PDF
          </a>
        </Button>
      </div>

      <Card>
        <CardContent className="px-5 py-4">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">About this standard</h2>
          <p className="max-w-3xl text-sm text-ink">{s.summary}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="items-center py-3">
          <CardTitle>Questions in this standard</CardTitle>
          <Badge>{s.questions.length}</Badge>
        </CardHeader>
        <ol className="divide-y divide-line">
          {s.questions.map((q) => (
            <li key={q.id} className="flex gap-4 px-5 py-3.5">
              <span className="w-24 shrink-0 pt-0.5 font-mono-data text-xs text-brand-strong">{q.ref === "mgmt" ? "Management" : q.ref}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">{q.text}</p>
                {q.hint && <p className="mt-1 text-xs text-ink-muted">{q.hint}</p>}
                <p className="mt-1 text-xs text-ink-faint">{questionTypeLabel(q.type)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

export default function GriStandardPage() {
  return (
    <PermissionGate module="question_bank" featureName="the question bank">
      <GriStandard />
    </PermissionGate>
  );
}
