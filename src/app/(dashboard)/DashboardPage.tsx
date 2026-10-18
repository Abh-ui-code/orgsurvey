"use client";

import { AlertTriangle, CheckCircle2, ClipboardCheck, FilePen, Hourglass, ListChecks, Undo2 } from "lucide-react";
import Link from "next/link";
import { CategoryBadge } from "@/components/shared/category-badge";
import { DueBadge } from "@/components/shared/due-badge";
import { WaitingOn } from "@/components/shared/waiting-on";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { SurveyStatusBadge } from "@/components/ui/status-badge";
import { useDashboard } from "@/hooks/use-dashboard";
import { usePermissions } from "@/hooks/use-permissions";
import { useSurveyList, useSurveyTasks } from "@/hooks/use-surveys";

/** A KPI that jumps to the matching, already-filtered survey list. */
function KpiLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block h-full rounded-xl transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
      {children}
    </Link>
  );
}

export default function DashboardPage() {
  const { user, isAdmin } = usePermissions();
  const dashboard = useDashboard();
  const tasks = useSurveyTasks({ page_size: 6 });
  const overdue = useSurveyList({ overdue: true, page_size: 5, ordering: "due_date" });
  const recent = useSurveyList({ page_size: 5, ordering: "-created_at" });

  if (dashboard.isPending || !user) return <Skeleton className="h-64 w-full" />;
  const counts = dashboard.data?.counts;
  const byUnit = dashboard.data?.by_unit ?? [];

  return (
    <div>
      <PageHeader title={`Welcome, ${user.full_name.split(" ")[0]}`} description="Where your organisational surveys stand." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        <KpiLink href="/tasks">
          <Kpi icon={ClipboardCheck} label="Waiting on you" value={counts?.waiting_on_you ?? 0} accent="amber" />
        </KpiLink>
        <KpiLink href="/surveys?overdue=true">
          <Kpi icon={AlertTriangle} label="Overdue" value={counts?.overdue ?? 0} accent="rust" sub={counts?.overdue ? "Past their due date" : "None overdue"} />
        </KpiLink>
        <KpiLink href="/surveys">
          <Kpi icon={ListChecks} label={isAdmin ? "Published surveys" : "Your surveys"} value={counts?.surveys ?? 0} />
        </KpiLink>
        <KpiLink href="/surveys?status=in_progress">
          <Kpi icon={Hourglass} label="In progress" value={counts?.in_progress ?? 0} accent="slate" />
        </KpiLink>
        <KpiLink href="/surveys?status=returned">
          <Kpi icon={Undo2} label="Returned" value={counts?.returned ?? 0} accent="rust" />
        </KpiLink>
        <KpiLink href="/surveys?status=approved">
          <Kpi icon={CheckCircle2} label="Approved" value={counts?.approved ?? 0} accent="moss" />
        </KpiLink>
        {isAdmin && (
          <KpiLink href="/surveys?status=draft">
            <Kpi icon={FilePen} label="Drafts" value={counts?.drafts ?? 0} sub="Not yet published" />
          </KpiLink>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Waiting on you</CardTitle>
            <Link href="/tasks" className="text-sm text-brand hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {tasks.data?.results.length === 0 ? (
              <p className="text-sm text-ink-muted">Nothing is waiting on you right now. 🎉</p>
            ) : (
              <ul className="divide-y divide-line">
                {tasks.data?.results.map((s) => (
                  <li key={s.id}>
                    <Link href={`/surveys/${s.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-brand">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{s.title}</span>
                        <span className="text-xs text-ink-faint">
                          <DueBadge dueDate={s.due_date} status={s.status} overdue={s.is_overdue} />
                        </span>
                      </span>
                      <Badge tone="brand">{s.my_task && `${s.my_task.action} · ${s.my_task.count}`}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isAdmin ? "Needs attention" : "Overdue"}</CardTitle>
            <Link href="/surveys?overdue=true" className="text-sm text-brand hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {overdue.data?.results.length === 0 ? (
              <p className="text-sm text-ink-muted">Nothing is overdue.</p>
            ) : (
              <ul className="divide-y divide-line">
                {overdue.data?.results.map((s) => (
                  <li key={s.id}>
                    <Link href={`/surveys/${s.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-brand">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{s.title}</span>
                        <span className="text-xs">
                          <WaitingOn holder={s.waiting_on} since={s.stage_since} />
                        </span>
                      </span>
                      <DueBadge dueDate={s.due_date} status={s.status} overdue={s.is_overdue} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress by org block</CardTitle>
          </CardHeader>
          <CardContent>
            {byUnit.length === 0 ? (
              <p className="text-sm text-ink-muted">No surveys are aimed at any block yet.</p>
            ) : (
              <ul className="space-y-3">
                {byUnit.map((row) => (
                  <li key={row.unit_id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-ink">{row.name}</span>
                      <span className="font-mono-data text-xs text-ink-muted">
                        {row.approved}/{row.total} approved
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-paper-sunken">
                      <div className="h-full bg-moss" style={{ width: `${(row.approved / row.total) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent surveys</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-line">
              {recent.data?.results.map((s) => (
                <li key={s.id}>
                  <Link href={`/surveys/${s.id}`} className="flex items-center justify-between gap-2 py-2.5 hover:text-brand">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink">{s.title}</span>
                      <CategoryBadge label={s.category.label} color={s.category.color} />
                    </span>
                    <SurveyStatusBadge status={s.status} />
                  </Link>
                </li>
              ))}
              {recent.data?.results.length === 0 && <li className="py-2 text-sm text-ink-muted">No surveys yet.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
