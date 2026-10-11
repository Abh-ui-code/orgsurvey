"use client";

import { Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PermissionGate } from "@/components/permission-gate";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { statusLabel } from "@/components/ui/status-badge";
import type { CategoryProgress, UnitProgress } from "@/types/reports";
import { useReportSummary } from "./_hooks/use-reports";

const percent = (done: number, total: number) => (total ? `${Math.round((done / total) * 100)}%` : "—");

const unitColumns: ColumnDef<UnitProgress & { id: string }>[] = [
  { key: "name", label: "Org block", render: (r) => <span className="font-medium text-ink">{r.name}</span> },
  { key: "total", label: "Surveys", render: (r) => r.total },
  { key: "approved", label: "Approved", render: (r) => r.approved },
  { key: "returned", label: "Returned", render: (r) => r.returned },
  { key: "rate", label: "Completion", render: (r) => percent(r.approved, r.total) },
];

const categoryColumns: ColumnDef<CategoryProgress & { id: string }>[] = [
  { key: "label", label: "Category", render: (r) => <span className="font-medium text-ink">{r.label}</span> },
  { key: "total", label: "Surveys", render: (r) => r.total },
  { key: "in_progress", label: "In progress", render: (r) => r.in_progress },
  { key: "approved", label: "Approved", render: (r) => r.approved },
  { key: "rate", label: "Completion", render: (r) => percent(r.approved, r.total) },
];

function Reports() {
  const report = useReportSummary();
  const byStatus = (report.data?.by_status ?? []).map((s) => ({ status: statusLabel(s.status), count: s.count }));

  function exportCsv() {
    if (!report.data) return;
    downloadCsv("survey-report", [
      ["Surveys by workflow stage"],
      ["Stage", "Surveys"],
      ...byStatus.map((r) => [r.status, r.count]),
      [],
      ["Rolled up by org block"],
      ["Org block", "Surveys", "Approved", "Returned", "Completion"],
      ...report.data.by_unit.map((r) => [r.name, r.total, r.approved, r.returned, percent(r.approved, r.total)]),
      [],
      ["By survey category"],
      ["Category", "Surveys", "In progress", "Approved", "Completion"],
      ...report.data.by_category.map((r) => [r.label, r.total, r.in_progress, r.approved, percent(r.approved, r.total)]),
    ]);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description="Survey progress, rolled up through the org hierarchy."
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={!report.data}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Surveys by workflow stage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStatus} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--line))" />
                <XAxis dataKey="status" tick={{ fontSize: 12, fill: "hsl(var(--ink-muted))" }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--ink-muted))" }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "hsl(var(--paper-sunken))" }} />
                <Bar dataKey="count" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">Rolled up by org block</h2>
        <DataTable
          columns={unitColumns}
          data={(report.data?.by_unit ?? []).map((r) => ({ ...r, id: r.unit_id }))}
          isLoading={report.isPending}
          isError={report.isError}
          emptyTitle="No survey data yet"
        />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">By survey category</h2>
        <DataTable
          columns={categoryColumns}
          data={(report.data?.by_category ?? []).map((r) => ({ ...r, id: r.category_id }))}
          isLoading={report.isPending}
          isError={report.isError}
          emptyTitle="No survey data yet"
        />
      </div>
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
