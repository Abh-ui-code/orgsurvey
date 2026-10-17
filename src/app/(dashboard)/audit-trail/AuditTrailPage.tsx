"use client";

import { History, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { Avatar } from "@/components/shared/avatar";
import { CategoryBadge } from "@/components/shared/category-badge";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { SurveyStatusBadge, statusLabel } from "@/components/ui/status-badge";
import { useDebounced } from "@/hooks/use-debounced";
import { useSurveyList } from "@/hooks/use-surveys";
import { formatRelativeShort } from "@/lib/format";
import { SURVEY_STATUSES, type Survey } from "@/types/survey";

/** Respondent, reviewer and approver as three overlapping avatars. */
function People({ survey }: { survey: Survey }) {
  const people = [survey.responder, survey.reviewer, survey.approver];
  return (
    <div className="flex items-center">
      {people.map((p, i) =>
        p ? (
          <span key={i} title={p.full_name} className="-ml-2 rounded-full ring-2 ring-paper-raised first:ml-0">
            <Avatar name={p.full_name} className="h-7 w-7" />
          </span>
        ) : (
          <span key={i} className="-ml-2 h-7 w-7 rounded-full border border-dashed border-line-strong bg-paper-sunken ring-2 ring-paper-raised first:ml-0" />
        ),
      )}
    </div>
  );
}

function AuditTrail() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const surveys = useSurveyList({ search: useDebounced(search), status, page, page_size: pageSize });
  const filtered = Boolean(search || status);

  const columns: ColumnDef<Survey>[] = [
    {
      key: "title",
      label: "Survey",
      render: (s) => (
        <div>
          <div className="font-medium text-ink">{s.title}</div>
          <div className="mt-1 flex items-center gap-2">
            <CategoryBadge label={s.category.label} color={s.category.color} />
            <span className="text-xs text-ink-faint">{s.target_unit.name}</span>
          </div>
        </div>
      ),
    },
    { key: "status", label: "Where it is", render: (s) => <SurveyStatusBadge status={s.status} /> },
    { key: "people", label: "Passed between", render: (s) => <People survey={s} /> },
    {
      key: "submitted",
      label: "Submitted",
      render: (s) => <span className="font-mono-data text-ink">{s.submission_count}×</span>,
    },
    {
      key: "returned",
      label: "Sent back",
      render: (s) =>
        s.return_count > 0 ? (
          <Badge tone="rust">
            <Undo2 className="h-3 w-3" /> {s.return_count}×
          </Badge>
        ) : (
          <span className="text-sm text-ink-faint">Never</span>
        ),
    },
    {
      key: "last",
      label: "Last activity",
      render: (s) => <span className="text-sm text-ink-muted">{s.status === "draft" ? "Not published" : formatRelativeShort(s.stage_since)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Audit trail" description="Follow any survey from first response to approval: who handled it, when, and every time it was sent back and why." />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search surveys"
          className="w-64"
        />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="w-52"
        >
          <option value="">All statuses</option>
          {SURVEY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={surveys.data?.results ?? []}
        isLoading={surveys.isPending}
        isFetching={surveys.isFetching}
        isError={surveys.isError}
        emptyIcon={History}
        emptyTitle={filtered ? "No surveys match" : "No surveys yet"}
        emptyDescription={filtered ? "Try a different search or status." : "Once a survey is published, its full history appears here."}
        onRowClick={(s) => router.push(`/audit-trail/${s.id}`)}
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

export default function AuditTrailPage() {
  return (
    <PermissionGate module="audit_trail" featureName="the audit trail">
      <AuditTrail />
    </PermissionGate>
  );
}
