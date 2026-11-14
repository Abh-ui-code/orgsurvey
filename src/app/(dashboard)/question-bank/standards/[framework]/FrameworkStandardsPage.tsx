"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { FRAMEWORKS, type StandardFramework } from "@/types/question";
import { GriTab } from "../../_components/gri-tab";

/** Every standard of one framework (all the GRI standards, all the SASB ones ...) on a page of its own. */
function FrameworkStandards() {
  const { framework } = useParams<{ framework: string }>();
  const [search, setSearch] = useState("");
  if (!(framework in FRAMEWORKS)) return <EmptyState title="Not found" description="There is no such set of standards." />;
  const f = FRAMEWORKS[framework as StandardFramework];
  return (
    <div className="space-y-5">
      <div>
        <Link href="/question-bank" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Question bank
        </Link>
        <h1 className="font-display text-2xl font-semibold text-ink">{f.label}</h1>
      </div>
      <SearchInput value={search} onChange={setSearch} placeholder={`Search ${f.short} standards`} className="w-72" />
      <GriTab search={search} framework={framework as StandardFramework} />
    </div>
  );
}

export default function FrameworkStandardsPage() {
  return (
    <PermissionGate module="question_bank" featureName="the question bank">
      <FrameworkStandards />
    </PermissionGate>
  );
}
