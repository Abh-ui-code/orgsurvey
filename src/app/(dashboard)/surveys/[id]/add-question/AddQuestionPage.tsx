"use client";

import { ArrowLeft, BookOpen, Check, FileText, Plus, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { IconButton } from "@/components/shared/icon-button";
import { QuestionFormFields, EMPTY_QUESTION, fieldsFromDraft, isDraftComplete, type QuestionDraft } from "@/components/shared/question-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GRI_CATEGORY, SASB_CATEGORY, TCFD_CATEGORY, RSPO_CATEGORY, WEF_CATEGORY, frameworkOf } from "@/app/(dashboard)/question-bank/_components/gri-tab";
import { useGriStandards } from "@/hooks/use-gri-standards";
import { useBankCategories } from "@/hooks/use-bank-categories";
import { useBankQuestions } from "@/hooks/use-bank-questions";
import { useDebounced } from "@/hooks/use-debounced";
import { useSurvey } from "@/hooks/use-surveys";
import { FRAMEWORKS, questionKindLabel, type StandardFramework } from "@/types/question";
import type { SurveyDetail } from "@/types/survey";
import { useAddQuestion, useDeleteQuestion, useDeleteSection } from "../_hooks/use-survey-builder";

const PAGE = 20;

/** Search the question bank and add questions to the section. */
function BankPicker({ survey, sectionId }: { survey: SurveyDetail; sectionId: string }) {
  const categories = useBankCategories();
  const add = useAddQuestion(survey.id);
  const remove = useDeleteQuestion(survey.id);
  const [search, setSearch] = useState("");
  // Coming back from a standard's question page (?gri=gri or ?gri=sasb) reopens that standards list.
  const fromUrl = useSearchParams().get("gri");
  const [category, setCategory] = useState(fromUrl === "sasb" ? SASB_CATEGORY : fromUrl === "tcfd" ? TCFD_CATEGORY : fromUrl === "rspo" ? RSPO_CATEGORY : fromUrl === "wef" ? WEF_CATEGORY : fromUrl ? GRI_CATEGORY : "");
  const [size, setSize] = useState(PAGE);
  const framework = frameworkOf(category);
  const gri = framework !== null;
  const bank = useBankQuestions({ search: useDebounced(search), category: gri ? "" : category, page_size: size }, !gri);

  // Which survey question (in any section) each bank question became, so "Added" can be undone.
  const used = new Map(
    survey.sections.flatMap((s) =>
      s.questions.filter((q) => q.bank_question_id).map((q) => [q.bank_question_id, { sectionId: s.id, id: q.id }] as const),
    ),
  );
  const rows = bank.data?.results ?? [];
  const total = bank.data?.count ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setSize(PAGE);
          }}
          placeholder={framework ? `Search ${framework.toUpperCase()} standards` : "Search the question bank"}
          className="min-w-60 flex-1"
        />
        <Select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setSize(PAGE);
          }}
          className="w-52"
        >
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
          <option value={GRI_CATEGORY}>GRI standards</option>
          <option value={SASB_CATEGORY}>SASB standards</option>
          <option value={TCFD_CATEGORY}>TCFD recommendations</option>
          <option value={RSPO_CATEGORY}>RSPO standards</option>
          <option value={WEF_CATEGORY}>WEF metrics</option>
        </Select>
      </div>

      {gri ? (
        <GriPicker survey={survey} search={search} sectionId={sectionId} framework={framework} />
      ) : (
        <>
          {bank.isPending ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={BookOpen} title="No questions match" description="Try another search, or write a new question on the other tab." />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {rows.map((q) => {
                const added = used.get(q.id);
                return (
                  <li key={q.id} className="flex flex-col justify-between gap-3 rounded-lg border border-line bg-paper-raised p-4">
                    <p className="text-sm text-ink">{q.text}</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
                        <Badge>{q.category.label}</Badge>
                        {questionKindLabel(q)}
                      </p>
                      {added ? (
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="flex items-center gap-1 text-xs font-medium text-moss">
                            <Check className="h-3.5 w-3.5" /> Added
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={remove.isPending}
                            onClick={() =>
                              remove.mutate(added, {
                                onSuccess: () => toast.success("Question removed"),
                                onError: (e) => toast.error((e as Error).message),
                              })
                            }
                          >
                            Remove
                          </Button>
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={add.isPending}
                          onClick={() =>
                            add.mutate(
                              { sectionId, bank_question_id: q.id },
                              { onSuccess: () => toast.success("Question added"), onError: (e) => toast.error((e as Error).message) },
                            )
                          }
                        >
                          <Plus className="h-3.5 w-3.5" /> Add
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {total > rows.length && (
            <div className="flex items-center justify-center gap-3 pt-1 text-xs text-ink-faint">
              Showing {rows.length} of {total}
              <Button variant="secondary" size="sm" loading={bank.isFetching} onClick={() => setSize((s) => s + PAGE)}>
                Show more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Choose which questions of a GRI or SASB standard go into the survey. */
function GriPicker({ survey, search, sectionId, framework }: { survey: SurveyDetail; search: string; sectionId: string; framework: StandardFramework }) {
  const f = FRAMEWORKS[framework];
  const standards = useGriStandards(framework);
  const remove = useDeleteSection(survey.id);
  const router = useRouter();
  const open = (standardId: string) => router.push(`/surveys/${survey.id}/add-question/gri/${standardId}?section=${sectionId}`);
  const q = search.trim().toLowerCase();
  const rows = (standards.data ?? []).filter((s) => !q || `${s.code} ${s.title}`.toLowerCase().includes(q));
  const added = new Map(survey.sections.filter((s) => s.gri).map((s) => [s.gri!.id, s]));
  const fail = (e: Error) => toast.error(e.message);

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Open a {f.short} standard and tick the questions you want. Only the ticked questions are added, as one section you then assign to one respondent.
      </p>
      {standards.isPending ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <EmptyState icon={FileText} title={`No ${f.short} standard matches`} description="Try a different search." />
      ) : (
        f.groups.map((series) => {
          const group = rows.filter((s) => s.series === series.value);
          if (group.length === 0) return null;
          return (
            <section key={series.value}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{series.label}</h3>
              <ul className="grid items-start gap-3 md:grid-cols-2">
                {group.map((s) => {
                  const section = added.get(s.id);
                  return (
                    <li
                      key={s.id}
                      className="flex cursor-pointer flex-col gap-2 rounded-lg border border-line bg-paper-raised p-4 hover:border-brand/40"
                      onClick={() => open(s.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone="brand">{s.code}</Badge>
                        <a
                          href={s.pdf}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-brand-strong hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" /> PDF
                        </a>
                      </div>
                      <p className="text-sm font-medium text-ink">{s.title}</p>
                      <p className="line-clamp-2 flex-1 text-xs text-ink-muted">{s.summary}</p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-ink-faint">
                          {section ? `${section.questions.length} of ${s.question_count}` : s.question_count} question
                          {s.question_count === 1 ? "" : "s"}
                        </span>
                        <span className="flex items-center gap-2">
                          {section && (
                            <>
                              <span className="flex items-center gap-1 text-xs font-medium text-moss">
                                <Check className="h-3.5 w-3.5" /> Added
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={remove.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  remove.mutate(section.id, { onSuccess: () => toast.success("Section removed"), onError: fail });
                                }}
                              >
                                Remove
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              open(s.id);
                            }}
                          >
                            {section ? "Edit selection" : "Choose questions"}
                          </Button>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

/** Write a one-off question straight into the section. */
function WriteNew({ surveyId, sectionId }: { surveyId: string; sectionId: string }) {
  const add = useAddQuestion(surveyId);
  const [draft, setDraft] = useState<QuestionDraft>(EMPTY_QUESTION);

  return (
    <form
      className="max-w-2xl space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isDraftComplete(draft)) return;
        add.mutate(
          { sectionId, ...fieldsFromDraft(draft) },
          {
            onSuccess: () => {
              toast.success("Question added");
              setDraft(EMPTY_QUESTION); // stay here to add several
            },
            onError: (err) => toast.error((err as Error).message),
          },
        );
      }}
    >
      <QuestionFormFields value={draft} onChange={setDraft} />
      <Button type="submit" disabled={!isDraftComplete(draft)} loading={add.isPending}>
        <Plus className="h-4 w-4" /> Add question
      </Button>
    </form>
  );
}

/** A full page for adding questions to one section of a draft survey. */
export default function AddQuestionPage() {
  const { id } = useParams<{ id: string }>();
  const sectionId = useSearchParams().get("section") ?? "";
  const survey = useSurvey(id);
  const remove = useDeleteQuestion(id);
  const back = `/surveys/${id}`;

  if (survey.isPending) return <Skeleton className="h-96 w-full" />;
  const section = survey.data?.sections.find((s) => s.id === sectionId);
  if (!survey.data || !section || survey.data.status !== "draft") {
    return (
      <EmptyState
        title="Section not found"
        description="Questions can only be added to a section of a draft survey."
        action={
          <Button asChild variant="secondary">
            <Link href={back}>Back to survey</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href={back} className="mb-2 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to {survey.data.title}
          </Link>
          <h1 className="font-display text-2xl font-semibold text-ink">{`Add questions to “${section.title}”`}</h1>
          <p className="mt-1 text-sm text-ink-muted">Pick from the question bank or write your own. Add as many as you like, then press Done.</p>
        </div>
        <Button asChild className="shrink-0">
          <Link href={back}>Done</Link>
        </Button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardContent className="px-5 py-4">
            <Tabs defaultValue="bank">
              <TabsList>
                <TabsTrigger value="bank">From question bank</TabsTrigger>
                <TabsTrigger value="new">Write new</TabsTrigger>
                {section.gri && <TabsTrigger value="gri">{section.gri.code} questions</TabsTrigger>}
              </TabsList>
              <TabsContent value="bank" className="pt-5">
                <BankPicker survey={survey.data} sectionId={section.id} />
              </TabsContent>
              {section.gri && (
                <TabsContent value="gri" className="space-y-3 pt-5">
                  <p className="text-sm text-ink-muted">Tick which questions of {section.gri.code}: {section.gri.title} belong in this section.</p>
                  <Button asChild variant="secondary">
                    <Link href={`/surveys/${survey.data.id}/add-question/gri/${section.gri.id}?section=${section.id}`}>Choose {section.gri.code} questions</Link>
                  </Button>
                </TabsContent>
              )}
              <TabsContent value="new" className="pt-5">
                <WriteNew surveyId={survey.data.id} sectionId={section.id} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="lg:sticky lg:top-4">
          <CardHeader className="items-center py-3">
            <CardTitle>In this section</CardTitle>
            <Badge>{section.questions.length}</Badge>
          </CardHeader>
          <CardContent className="max-h-[60vh] overflow-y-auto px-5 py-3">
            {section.questions.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-muted">Nothing yet. Added questions show up here.</p>
            ) : (
              <ol className="space-y-3">
                {section.questions.map((q) => (
                  <li key={q.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="text-ink">
                        <span className="mr-1.5 font-medium text-ink-muted">Q{q.number}</span>
                        {q.text}
                      </p>
                      <p className="text-xs text-ink-faint">{questionKindLabel(q)}</p>
                    </div>
                    <IconButton
                      label="Remove question"
                      disabled={remove.isPending}
                      onClick={() =>
                        remove.mutate(
                          { sectionId: section.id, id: q.id },
                          { onSuccess: () => toast.success("Question removed"), onError: (e) => toast.error((e as Error).message) },
                        )
                      }
                    >
                      <X className="h-4 w-4" />
                    </IconButton>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
