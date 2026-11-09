"use client";

import { ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useGriStandards } from "@/hooks/use-gri-standards";
import { FRAMEWORKS, type StandardFramework } from "@/types/question";

/** The values of the category filter that show the GRI, SASB, TCFD, RSPO or WEF standards instead of questions. */
export const GRI_CATEGORY = "gri";
export const SASB_CATEGORY = "sasb";
export const TCFD_CATEGORY = "tcfd";
export const RSPO_CATEGORY = "rspo";
export const WEF_CATEGORY = "wef";

/** The framework a category-filter value stands for, if it is one of the standards lists. */
export const frameworkOf = (category: string): StandardFramework | null => (category === GRI_CATEGORY ? "gri" : category === SASB_CATEGORY ? "sasb" : category === TCFD_CATEGORY ? "tcfd" : category === RSPO_CATEGORY ? "rspo" : category === WEF_CATEGORY ? "wef" : null);

/** Every standard of one framework, grouped by series (GRI) or sector (SASB). Each opens its own page. */
export function GriTab({ search, framework = "gri" }: { search: string; framework?: StandardFramework }) {
  const f = FRAMEWORKS[framework];
  const standards = useGriStandards(framework);
  const q = search.trim().toLowerCase();
  const rows = (standards.data ?? []).filter((s) => !q || `${s.code} ${s.title}`.toLowerCase().includes(q));

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-ink-muted">
        Each {f.short} standard is a ready-made section: a short summary, the PDF, and the questions it asks. Add it to a survey as a whole section and give
        it to one respondent.
      </p>
      {standards.isPending ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={FileText} title={`No ${f.short} standard matches`} description="Try a different search." />
      ) : (
        f.groups.map((series) => {
          const group = rows.filter((s) => s.series === series.value);
          if (group.length === 0) return null;
          return (
            <section key={series.value}>
              <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-ink">
                {series.label}
                <span className="text-xs font-normal text-ink-faint">{series.blurb}</span>
              </h2>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/question-bank/gri/${s.id}`}
                      className="group flex h-full flex-col rounded-xl border border-line bg-paper-raised p-4 shadow-card transition-colors hover:border-brand/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone="brand">{s.code}</Badge>
                        <span className="text-xs text-ink-faint">{s.edition}</span>
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-ink group-hover:text-brand-strong">{s.title}</h3>
                      <p className="mt-1 line-clamp-2 flex-1 text-xs text-ink-muted">{s.summary}</p>
                      <p className="mt-3 flex items-center justify-between text-xs text-ink-faint">
                        {s.question_count} question{s.question_count === 1 ? "" : "s"}
                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
