"use client";

import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/permission-gate";
import { CategoryBadge } from "@/components/shared/category-badge";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { SurveyStatusBadge } from "@/components/ui/status-badge";
import { useDebounced } from "@/hooks/use-debounced";
import { useSurveyList } from "@/hooks/use-surveys";
import { downloadFile } from "@/lib/api";
import { slug } from "@/lib/csv";
import type { Survey } from "@/types/survey";

function Reports() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [busy, setBusy] = useState<string | null>(null);
  const surveys = useSurveyList({ search: useDebounced(search), page, page_size: pageSize, ordering: "-created_at" });

  async function download(survey: Survey) {
    setBusy(survey.id);
    try {
      await downloadFile(`/reports/surveys/${survey.id}/audit/`, `${slug(survey.title)}-audit-trail-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

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
    { key: "unit", label: "Aimed at", render: (s) => s.target_unit.name },
    {
      key: "people",
      label: "Responder → reviewer → approver",
      render: (s) => [s.responder, s.reviewer, s.approver].map((p) => p?.full_name ?? "—").join(" → "),
    },
    {
      key: "download",
      label: "",
      render: (s) => (
        <Button variant="secondary" size="sm" loading={busy === s.id} disabled={s.status === "draft"} onClick={() => download(s)}>
          <FileSpreadsheet className="h-4 w-4" /> Audit trail (Excel)
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description="Download a survey's full audit trail as one Excel sheet: survey details, a timeline of every step, and each question with its answers per submission and the comments made on it."
      />
      <SearchInput
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Search surveys"
        className="w-64"
      />
      <DataTable
        columns={columns}
        data={surveys.data?.results ?? []}
        isLoading={surveys.isPending}
        isError={surveys.isError}
        emptyTitle="No surveys yet"
        isFetching={surveys.isFetching}
        pagination={{ page, pageSize, total: surveys.data?.count ?? 0 }}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}

export default function ReportsPage() {
  return (
    <div>
      <PermissionGate module="reports" featureName="reports">
        <Reports />
      </PermissionGate>
    </div>
  );
}
