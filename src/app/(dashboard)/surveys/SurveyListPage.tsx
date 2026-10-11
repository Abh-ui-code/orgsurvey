"use client";

import { ListChecks, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CategoryBadge } from "@/components/shared/category-badge";
import { DueBadge } from "@/components/shared/due-badge";
import { WaitingOn } from "@/components/shared/waiting-on";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { SurveyStatusBadge, statusLabel } from "@/components/ui/status-badge";
import { useDebounced } from "@/hooks/use-debounced";
import { usePermissions } from "@/hooks/use-permissions";
import { useSurveyCategories } from "@/hooks/use-survey-categories";
import { useSurveyList } from "@/hooks/use-surveys";
import { SURVEY_STATUSES, type Survey } from "@/types/survey";
import { CreateSurveyDrawer } from "./_components/create-survey-drawer";

export default function SurveyListPage() {
  const router = useRouter();
  const { isAdmin } = usePermissions();
  const categories = useSurveyCategories();
  // Dashboard cards link here with a filter already applied (?overdue=true, ?status=returned).
  const params = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(params.get("category") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [overdue, setOverdue] = useState(params.get("overdue") === "true");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [creating, setCreating] = useState(false);

  const surveys = useSurveyList({
    search: useDebounced(search),
    category,
    status: status === "in_progress" ? undefined : status,
    in_progress: status === "in_progress" || undefined,
    overdue: overdue || undefined,
    page,
    page_size: pageSize,
  });
  const filtered = Boolean(search || category || status || overdue);

  // Changing any filter starts again from the first page.
  const filter = <T,>(set: (v: T) => void) => (value: T) => {
    set(value);
    setPage(1);
  };

  const columns: ColumnDef<Survey>[] = [
    {
      key: "title",
      label: "Survey",
      render: (s) => (
        <div>
          <div className="font-medium text-ink">{s.title}</div>
          <div className="mt-1">
            <CategoryBadge label={s.category.label} color={s.category.color} />
          </div>
        </div>
      ),
    },
    { key: "status", label: "Status", render: (s) => <SurveyStatusBadge status={s.status} /> },
    { key: "waiting", label: "Waiting on", render: (s) => <WaitingOn holder={s.waiting_on} since={s.stage_since} /> },
    { key: "unit", label: "Aimed at", render: (s) => s.target_unit.name },
    { key: "questions", label: "Questions", render: (s) => <span className="font-mono-data text-ink">{s.question_count}</span> },
    { key: "due", label: "Due", render: (s) => <DueBadge dueDate={s.due_date} status={s.status} overdue={s.is_overdue} /> },
  ];

  const newButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus className="h-4 w-4" /> New survey
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Surveys"
        description={isAdmin ? "Every organisational survey, across every topic." : "Surveys you are involved in."}
        actions={isAdmin && newButton}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={search} onChange={filter(setSearch)} placeholder="Search surveys" className="w-64" />
        <Select value={category} onChange={(e) => filter(setCategory)(e.target.value)} className="w-52">
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => filter(setStatus)(e.target.value)} className="w-52">
          <option value="">All statuses</option>
          <option value="in_progress">In progress (any stage)</option>
          {SURVEY_STATUSES.filter((s) => isAdmin || s !== "draft").map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </Select>
        <Select value={overdue ? "overdue" : ""} onChange={(e) => filter(setOverdue)(e.target.value === "overdue")} className="w-44">
          <option value="">Any deadline</option>
          <option value="overdue">Overdue only</option>
        </Select>
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setCategory("");
              setStatus("");
              setOverdue(false);
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={surveys.data?.results ?? []}
        isLoading={surveys.isPending}
        isFetching={surveys.isFetching}
        isError={surveys.isError}
        emptyIcon={ListChecks}
        emptyTitle={filtered ? "No surveys match" : "No surveys yet"}
        emptyDescription={filtered ? "Try clearing a filter." : isAdmin ? "Create a survey, add questions, then assign and publish it." : undefined}
        emptyAction={isAdmin && !filtered ? newButton : undefined}
        onRowClick={(s) => router.push(`/surveys/${s.id}`)}
        pagination={{ page, pageSize, total: surveys.data?.count ?? 0 }}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
      <CreateSurveyDrawer open={creating} onOpenChange={setCreating} />
    </div>
  );
}
