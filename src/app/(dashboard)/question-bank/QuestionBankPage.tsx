"use client";

import { ChevronRight, FolderCog, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { EMPTY_QUESTION } from "@/components/shared/question-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useBankCategories } from "@/hooks/use-bank-categories";
import { useBankQuestions } from "@/hooks/use-bank-questions";
import { useDebounced } from "@/hooks/use-debounced";
import { useGriStandards } from "@/hooks/use-gri-standards";
import {
  FRAMEWORKS,
  questionKindLabel,
  type StandardFramework,
} from "@/types/question";
import { CategoriesDialog } from "./_components/categories-dialog";
import { QuestionDialog, type BankDraft } from "./_components/question-dialog";

const FRAMEWORK_BLURB: Record<StandardFramework, string> = {
  gri: "The GRI Standards: universal, sector and topic disclosures for sustainability reporting.",
  sasb: "SASB industry standards: the sustainability metrics that matter most in each industry.",
  tcfd: "TCFD recommendations on climate-related governance, strategy, risk management and metrics.",
  rspo: "RSPO principles and criteria for sustainable palm oil production.",
  wef: "WEF stakeholder capitalism metrics across people, planet, prosperity and governance.",
};

function Card({
  href,
  tag,
  title,
  text,
  footer,
}: {
  href: string;
  tag: string;
  title: string;
  text: string;
  footer: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-xl border border-line bg-paper-raised p-5 shadow-card transition-colors hover:border-brand/50"
    >
      <span className="w-fit rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-strong">
        {tag}
      </span>
      <h3 className="mt-3 text-base font-semibold text-ink group-hover:text-brand-strong">
        {title}
      </h3>
      <p className="mt-1 line-clamp-2 min-h-[2.5rem] flex-1 text-sm text-ink-muted">
        {text}
      </p>
      <p className="mt-4 flex items-center justify-between text-sm text-ink-faint">
        {footer}
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </p>
    </Link>
  );
}

const count = (n: number | undefined, one: string) =>
  n === undefined ? "" : `${n} ${one}${n === 1 ? "" : "s"}`;

/** The question bank as big boxes: each category, and each set of standards, opens on a page of its own. */
function QuestionBank() {
  const categories = useBankCategories();
  const lists = {
    gri: useGriStandards("gri").data,
    sasb: useGriStandards("sasb").data,
    tcfd: useGriStandards("tcfd").data,
    rspo: useGriStandards("rspo").data,
    wef: useGriStandards("wef").data,
  };
  const counts = Object.fromEntries(
    Object.entries(lists).map(([f, l]) => [f, l?.length]),
  ) as Record<StandardFramework, number | undefined>;
  const [search, setSearch] = useState("");
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const searching = words.length > 0;
  const has = (text: string) =>
    words.every((w) => text.toLowerCase().includes(w));
  const questions = useBankQuestions(
    { search: useDebounced(search.trim()), page_size: 8 },
    searching,
  );
  const [draft, setDraft] = useState<BankDraft | null>(null);
  const [manage, setManage] = useState(false);
  const total = categories.data?.reduce((n, c) => n + c.question_count, 0);

  const frameworks = (Object.keys(FRAMEWORKS) as StandardFramework[]).filter(
    (f) =>
      !searching ||
      has(
        `${FRAMEWORKS[f].label} ${FRAMEWORKS[f].short} ${FRAMEWORK_BLURB[f]}`,
      ),
  );
  const cats = (categories.data ?? []).filter(
    (c) => !searching || has(`${c.label} ${c.description}`),
  );
  const showAll = !searching || has("all questions every reusable question");
  const standards = searching
    ? (Object.keys(FRAMEWORKS) as StandardFramework[]).flatMap((f) =>
        (lists[f] ?? []).filter((x) =>
          has(`${x.code} ${x.title} ${FRAMEWORKS[f].short}`),
        ),
      )
    : [];
  const nothing =
    searching &&
    frameworks.length === 0 &&
    cats.length === 0 &&
    !showAll &&
    standards.length === 0 &&
    !questions.isPending &&
    (questions.data?.results.length ?? 0) === 0;

  return (
    <>
      <PageHeader
        title="Question bank"
        description="Reusable questions that surveys are built from."
        actions={
          <>
            <Button variant="secondary" onClick={() => setManage(true)}>
              <FolderCog className="h-4 w-4" /> Categories
            </Button>
            <Button
              onClick={() =>
                setDraft({
                  ...EMPTY_QUESTION,
                  category_id: categories.data?.[0]?.id || "",
                })
              }
            >
              <Plus className="h-4 w-4" /> Add question
            </Button>
          </>
        }
      />
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search standards, categories and questions"
        className="mb-6 w-full max-w-md"
      />
      {nothing && (
        <p className="py-10 text-center text-sm text-ink-muted">
          Nothing matches “{search}”.
        </p>
      )}
      <div className="space-y-8">
        {standards.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ink">
              Matching standards{" "}
              <span className="text-xs font-normal text-ink-faint">
                {standards.length}
              </span>
            </h2>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {standards.slice(0, 24).map((x) => (
                <li key={x.id}>
                  <Link
                    href={`/question-bank/gri/${x.id}`}
                    className="group flex h-full items-center justify-between gap-3 rounded-xl border border-line bg-paper-raised px-4 py-3 shadow-card transition-colors hover:border-brand/50"
                  >
                    <span className="min-w-0">
                      <Badge tone="brand">{x.code}</Badge>
                      <span className="mt-1.5 block truncate text-sm font-semibold text-ink group-hover:text-brand-strong">
                        {x.title}
                      </span>
                      <span className="text-xs text-ink-faint">
                        {FRAMEWORKS[x.framework].short} · {x.question_count}{" "}
                        question{x.question_count === 1 ? "" : "s"}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
                  </Link>
                </li>
              ))}
            </ul>
            {standards.length > 24 && (
              <p className="mt-2 text-xs text-ink-faint">
                Showing 24 of {standards.length}. Type more to narrow it down.
              </p>
            )}
          </section>
        )}
        {searching && (questions.data?.results.length ?? 0) > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ink">
              Matching questions{" "}
              <span className="text-xs font-normal text-ink-faint">
                {questions.data?.count}
              </span>
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper-raised shadow-card">
              {questions.data?.results.map((q) => (
                <li key={q.id}>
                  <Link
                    href={`/question-bank/category/${q.category.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper-sunken/50"
                  >
                    <span className="min-w-0 text-sm text-ink">{q.text}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-ink-faint">
                      {questionKindLabel(q)}{" "}
                      <Badge>{q.category.label}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {frameworks.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-ink">
              Standards{" "}
              <span className="text-xs font-normal text-ink-faint">
                Ready-made sections with their own questions and PDFs
              </span>
            </h2>
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {frameworks.map((f) => (
                <li key={f}>
                  <Card
                    href={`/question-bank/standards/${f}`}
                    tag={FRAMEWORKS[f].short}
                    title={FRAMEWORKS[f].label}
                    text={FRAMEWORK_BLURB[f]}
                    footer={count(counts[f], "standard")}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
        {(showAll || cats.length > 0) && (
          <section>
            <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-ink">
              Categories{" "}
              <span className="text-xs font-normal text-ink-faint">
                Your own reusable questions
              </span>
            </h2>
            {categories.isPending ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-36" />
                ))}
              </div>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {showAll && (
                  <li>
                    <Card
                      href="/question-bank/category/all"
                      tag="All"
                      title="All questions"
                      text="Every reusable question, across all categories."
                      footer={count(total, "question")}
                    />
                  </li>
                )}
                {cats.map((c) => (
                  <li key={c.id}>
                    <Card
                      href={`/question-bank/category/${c.id}`}
                      tag="Category"
                      title={c.label}
                      text={
                        c.description ||
                        "Reusable questions filed under this category."
                      }
                      footer={count(c.question_count, "question")}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
      <QuestionDialog draft={draft} onClose={() => setDraft(null)} />
      <CategoriesDialog open={manage} onClose={() => setManage(false)} />
    </>
  );
}

export default function QuestionBankPage() {
  return (
    <PermissionGate module="question_bank" featureName="the question bank">
      <QuestionBank />
    </PermissionGate>
  );
}
