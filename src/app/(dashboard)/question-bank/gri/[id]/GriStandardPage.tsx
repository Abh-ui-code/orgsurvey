"use client";

import { ArrowLeft, Download, FileText } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useGriStandard } from "@/hooks/use-gri-standards";
import { disclosureLabel, filterQuestions, groupByDisclosure, questionNumber } from "@/lib/gri";
import { FRAMEWORKS, questionKindLabel, partsSummary } from "@/types/question";

/** One GRI standard on its own page: what it is, its PDF, and its questions. */
function GriStandard() {
  const { id } = useParams<{ id: string }>();
  const standard = useGriStandard(id);
  const [search, setSearch] = useState("");

  const back = `/question-bank/standards/${standard.data?.framework ?? "gri"}`;
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
  const shown = filterQuestions(s.questions, search);
  const framework = FRAMEWORKS[s.framework];
  const series = framework.groups.find((x) => x.value === s.series);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href={back} className="mb-2 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> {framework.label}
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
          <div className="flex items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by number or text" className="w-64" />
            <Badge>{search ? `${shown.length} of ${s.questions.length}` : s.questions.length}</Badge>
          </div>
        </CardHeader>
        {shown.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink-muted">No questions match “{search}”.</p>}
        <div className="divide-y divide-line">
          {groupByDisclosure(shown).map((group) => (
            <section key={`${group.ref}-${group.items[0].id}`}>
              {group.title && (
                <h3 className="bg-paper-sunken/60 px-5 py-2.5 text-sm font-semibold text-ink">
                  <span className="font-mono-data text-brand-strong">{disclosureLabel(group.ref)}</span> {group.title}
                </h3>
              )}
              <ol className="divide-y divide-line">
                {group.items.map((q) => (
                  <li key={q.id} className="flex gap-4 px-5 py-3.5">
                    <span className="w-24 shrink-0 pt-0.5 font-mono-data text-xs text-brand-strong">{questionNumber(q.ref, q.item)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">{q.text}</p>
                      {q.hint && <p className="mt-1 text-xs text-ink-muted">{q.hint}</p>}
                      <p className="mt-1 text-xs text-ink-faint">{questionKindLabel(q)}</p>
                      {q.type === "table" && <p className="mt-0.5 text-xs text-ink-muted">Rows: {partsSummary(q.parts)}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
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
