"use client";

import { ClipboardCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CategoryBadge } from "@/components/shared/category-badge";
import { DueBadge } from "@/components/shared/due-badge";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { SurveyStatusBadge } from "@/components/ui/status-badge";
import { useSurveyTasks } from "@/hooks/use-surveys";
import { roleName, type Survey } from "@/types/survey";

export default function TasksPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const tasks = useSurveyTasks({ page, page_size: pageSize });

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
    {
      key: "role",
      label: "Your role",
      render: (s) => (
        <Badge tone="brand" className="capitalize">
          {s.my_task && roleName(s.my_task.role)}
        </Badge>
      ),
    },
    { key: "action", label: "What's needed", render: (s) => s.my_task?.action },
    { key: "status", label: "Status", render: (s) => <SurveyStatusBadge status={s.status} /> },
    { key: "due", label: "Due", render: (s) => <DueBadge dueDate={s.due_date} status={s.status} overdue={s.is_overdue} /> },
  ];

  return (
    <div>
      <PageHeader title="My tasks" description="Surveys waiting on you to respond, review or approve." />
      <DataTable
        columns={columns}
        data={tasks.data?.results ?? []}
        isLoading={tasks.isPending}
        isFetching={tasks.isFetching}
        isError={tasks.isError}
        emptyIcon={ClipboardCheck}
        emptyTitle="You're all caught up"
        emptyDescription="Nothing is waiting on you right now."
        onRowClick={(s) => router.push(`/surveys/${s.id}`)}
        pagination={{ page, pageSize, total: tasks.data?.count ?? 0 }}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}
