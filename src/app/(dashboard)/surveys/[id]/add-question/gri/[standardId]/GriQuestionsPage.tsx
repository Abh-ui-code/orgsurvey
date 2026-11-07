"use client";

import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useGriStandard } from "@/hooks/use-gri-standards";
import { useSurvey } from "@/hooks/use-surveys";
import { questionTypeLabel } from "@/types/question";
import type { GriStandardDetail } from "@/types/question";
import type { SurveyDetail } from "@/types/survey";
import { useAddGriSection } from "../../../_hooks/use-survey-builder";

function Chooser({ survey, standard, back }: { survey: SurveyDetail; standard: GriStandardDetail; back: string }) {
  const router = useRouter();
  const add = useAddGriSection(survey.id);
  const section = survey.sections.find((s) => s.gri?.id === standard.id);
  const [picked, setPicked] = useState<Set<string>>(
    new Set(section?.questions.flatMap((q) => (q.bank_question_id ? [q.bank_question_id] : []))),
  );
  const questions = standard.questions;
  const all = questions.length > 0 && picked.size === questions.length;
  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href={back} className="mb-2 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to GRI standards
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-ink">{`${standard.code}: ${standard.title}`}</h1>
            <Badge tone="brand">{standard.edition}</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">{standard.summary}</p>
        </div>
        <a href={standard.pdf} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-brand-strong hover:underline">
          <FileText className="h-4 w-4" /> PDF
        </a>
      </div>

      <Card>
        <CardHeader className="items-center py-3">
          <CardTitle>Tick the questions to add to the survey</CardTitle>
          <label className="flex items-center gap-2 text-xs font-medium text-ink-muted">
            <input type="checkbox" checked={all} onChange={() => setPicked(all ? new Set() : new Set(questions.map((q) => q.id)))} />
            Select all ({questions.length})
          </label>
        </CardHeader>
        <ul className="divide-y divide-line">
          {questions.map((q, i) => (
            <li key={q.id}>
              <label className="flex cursor-pointer items-start gap-3 px-5 py-3.5 hover:bg-paper-sunken/50">
                <input type="checkbox" className="mt-1" checked={picked.has(q.id)} onChange={() => toggle(q.id)} />
                <span className="w-8 shrink-0 pt-0.5 font-mono-data text-xs text-brand-strong">{`Q${i + 1}`}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">{q.text}</span>
                  {q.hint && <span className="mt-1 block text-xs text-ink-muted">{q.hint}</span>}
                  <span className="mt-1 block text-xs text-ink-faint">{questionTypeLabel(q.type)}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Card>

      <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-3 border-t border-line bg-paper px-1 py-3">
        <span className="text-sm text-ink-muted">
          {picked.size} of {questions.length} selected
        </span>
        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link href={back}>Cancel</Link>
          </Button>
          <Button
            disabled={picked.size === 0}
            loading={add.isPending}
            onClick={() =>
              add.mutate(
                { standardId: standard.id, questionIds: questions.filter((q) => picked.has(q.id)).map((q) => q.id) },
                {
                  onSuccess: () => {
                    toast.success(`${picked.size} ${standard.code} question${picked.size === 1 ? "" : "s"} in the survey`);
                    router.push(back);
                  },
                  onError: (e) => toast.error((e as Error).message),
                },
              )
            }
          >
            {section ? "Update selection" : `Add ${picked.size} selected`}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** One GRI standard's questions on a full page, to tick the ones that go into the survey. */
export default function GriQuestionsPage() {
  const { id, standardId } = useParams<{ id: string; standardId: string }>();
  const sectionId = useSearchParams().get("section") ?? "";
  const survey = useSurvey(id);
  const standard = useGriStandard(standardId);
  const back = `/surveys/${id}/add-question?section=${sectionId}&gri=1`;

  if (survey.isPending || standard.isPending) return <Skeleton className="h-96 w-full" />;
  if (!survey.data || !standard.data || survey.data.status !== "draft") {
    return (
      <EmptyState
        title="Standard not found"
        description="GRI questions can only be added to a draft survey."
        action={
          <Button asChild variant="secondary">
            <Link href={`/surveys/${id}`}>Back to survey</Link>
          </Button>
        }
      />
    );
  }
  return <Chooser survey={survey.data} standard={standard.data} back={back} />;
}
