"use client";

import { ArrowLeft, Check, ChevronDown, ChevronRight, ClipboardList, Network, Pencil, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/shared/avatar";
import { DueBadge } from "@/components/shared/due-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Kpi } from "@/components/ui/kpi";
import { Skeleton } from "@/components/ui/skeleton";
import { SurveyStatusBadge } from "@/components/ui/status-badge";
import { usePermissions } from "@/hooks/use-permissions";
import { useSurveyList } from "@/hooks/use-surveys";
import { useUnits } from "@/hooks/use-units";
import { defaultChildKind, flattenWithDepth, unitPath } from "@/lib/org";
import { unitKindLabel } from "@/types/org";
import { KIND_TONE } from "../_components/unit-card";
import { UnitFormDialog, type UnitDraft } from "../_components/unit-form-dialog";
import { useDeleteUnit, useUnitMembers } from "../_hooks/use-organisation";

/** One org block on its own page: who is in it, its sub-blocks, and every
 * survey aimed at it (each one opens that survey). */
export default function UnitPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const units = useUnits();
  const { isAdmin } = usePermissions();
  const members = useUnitMembers(id);
  const surveys = useSurveyList({ target_unit: id, page_size: 100 });
  const del = useDeleteUnit();
  const [form, setForm] = useState<UnitDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (units.isPending) return <Skeleton className="h-96 w-full" />;
  const all = units.data ?? [];
  const unit = all.find((u) => u.id === id);
  if (!unit) {
    return (
      <EmptyState
        icon={Network}
        title="Block not found"
        description="It may have been deleted."
        action={
          <Button asChild variant="secondary">
            <Link href="/organisation">Back to organisation</Link>
          </Button>
        }
      />
    );
  }

  const children = all.filter((u) => u.parent_id === unit.id);
  const parent = all.find((u) => u.id === unit.parent_id);
  const surveyRows = surveys.data?.results ?? [];
  const memberRows = members.data?.results ?? [];
  // Other blocks the people here also belong to, each listed once.
  const linked = [
    ...new Map(
      memberRows
        .flatMap((m) => m.units)
        .filter((b) => b.id !== unit.id)
        .map((b) => [b.id, b]),
    ).values(),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/organisation" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> Organisation
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-ink">{unit.name}</h1>
            <Badge tone={KIND_TONE[unit.kind]}>{unitKindLabel(unit.kind)}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-muted">{unitPath(all, unit.id)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" aria-label="Switch block" className="max-w-56">
                <span className="truncate">{unit.name}</span> <ChevronDown className="h-4 w-4 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-96 min-w-64 overflow-y-auto">
              {linked.length > 0 && (
                <>
                  <DropdownMenuLabel>Also where this block&apos;s people work</DropdownMenuLabel>
                  {linked.map((b) => (
                    <DropdownMenuItem key={b.id} onSelect={() => router.push(`/organisation/${b.id}`)}>
                      {b.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuLabel>All blocks</DropdownMenuLabel>
              {flattenWithDepth(all).map(({ unit: b, depth }) => (
                <DropdownMenuItem
                  key={b.id}
                  onSelect={() => b.id !== unit.id && router.push(`/organisation/${b.id}`)}
                  style={{ paddingLeft: 8 + depth * 14 }}
                >
                  <span className="flex-1">{b.name}</span>
                  {b.id === unit.id && <Check className="h-4 w-4 text-brand" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {isAdmin && (
            <>
              <Button
                onClick={() =>
                  setForm({
                    parent_id: unit.id,
                    name: "",
                    kind: defaultChildKind(unit.kind),
                    head_id: "",
                  })
                }
              >
                <Plus className="h-4 w-4" /> Add child
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  setForm({
                    id: unit.id,
                    parent_id: unit.parent_id,
                    name: unit.name,
                    kind: unit.kind,
                    head_id: unit.head?.id ?? "",
                  })
                }
              >
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              {unit.parent_id && (
                <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Users} label="Members" value={members.data?.count ?? unit.member_count} accent="brand" />
        <Kpi icon={ClipboardList} label="Surveys aimed here" value={surveys.data?.count ?? 0} accent="moss" />
        <Kpi icon={Network} label="Sub-blocks" value={children.length} accent="amber" />
        <div className="h-full min-h-[7rem] rounded-xl border border-line border-l-[3px] border-l-slate bg-paper-raised p-4 shadow-card">
          <div className="text-xs font-medium text-ink-muted">Head of block</div>
          {unit.head ? (
            <div className="mt-3 flex items-center gap-2">
              <Avatar name={unit.head.full_name} className="h-8 w-8" />
              <span className="truncate text-sm font-medium text-ink">{unit.head.full_name}</span>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-faint">No head assigned</p>
          )}
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="items-center py-3">
            <CardTitle>Surveys aimed here</CardTitle>
            <Badge>{surveys.data?.count ?? 0}</Badge>
          </CardHeader>
          {surveys.isPending ? (
            <CardContent className="space-y-2 px-5 py-4">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </CardContent>
          ) : surveyRows.length === 0 ? (
            <CardContent className="px-5 py-10 text-center text-sm text-ink-muted">No survey is aimed at this block yet.</CardContent>
          ) : (
            <ul className="divide-y divide-line">
              {surveyRows.map((s) => (
                <li key={s.id}>
                  <Link href={`/surveys/${s.id}`} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper-sunken">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink group-hover:text-brand-strong">{s.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                        {s.category.label}
                        <span>
                          · {s.question_count} question
                          {s.question_count === 1 ? "" : "s"}
                        </span>
                        <span>
                          · Due <DueBadge dueDate={s.due_date} status={s.status} overdue={s.is_overdue} />
                        </span>
                      </p>
                    </div>
                    <SurveyStatusBadge status={s.status} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader className="items-center py-3">
              <CardTitle>Members</CardTitle>
              <Badge>{members.data?.count ?? unit.member_count}</Badge>
            </CardHeader>
            <CardContent className="px-5 py-3">
              {members.isPending ? (
                <Skeleton className="h-12" />
              ) : memberRows.length === 0 ? (
                <p className="py-3 text-center text-sm text-ink-muted">No one is placed in this block.</p>
              ) : (
                <ul className="space-y-3">
                  {memberRows.map((m) => (
                    <li key={m.id} className="flex items-center gap-2.5 text-sm">
                      <Avatar name={m.full_name} className="h-8 w-8" />
                      <span className="min-w-0">
                        <span className="block truncate text-ink">
                          {m.full_name}
                          {m.id === unit.head?.id && <span className="ml-1.5 text-xs text-amber">head</span>}
                        </span>
                        <span className="block truncate text-xs text-ink-faint">{m.title}</span>
                        {m.units.length > 1 && (
                          <span className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="text-2xs text-ink-faint">Also in</span>
                            {m.units
                              .filter((b) => b.id !== unit.id)
                              .map((b) => (
                                <Link
                                  key={b.id}
                                  href={`/organisation/${b.id}`}
                                  className="rounded-full bg-paper-sunken px-2 py-0.5 text-xs text-ink hover:bg-brand-soft hover:text-brand-strong"
                                  title={`Switch to ${b.name}`}
                                >
                                  {b.name}
                                </Link>
                              ))}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {(children.length > 0 || parent) && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle>Around this block</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-5 py-3 text-sm">
                {parent && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Reports to</p>
                    <Link href={`/organisation/${parent.id}`} className="text-ink hover:text-brand-strong">
                      {parent.name}
                    </Link>
                  </div>
                )}
                {children.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Sub-blocks</p>
                    <ul className="space-y-1.5">
                      {children.map((c) => (
                        <li key={c.id}>
                          <Link href={`/organisation/${c.id}`} className="flex items-center justify-between gap-2 text-ink hover:text-brand-strong">
                            <span className="truncate">{c.name}</span>
                            <Badge tone={KIND_TONE[c.kind]}>{unitKindLabel(c.kind)}</Badge>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <UnitFormDialog draft={form} units={all} onClose={() => setForm(null)} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        variant="danger"
        title={`Delete “${unit.name}”?`}
        description={
          children.length > 0
            ? "This block still has child blocks. Move or delete them first."
            : "Its members move up to the parent block. This cannot be undone."
        }
        confirmLabel="Delete"
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(unit.id, {
            onSuccess: () => {
              toast.success("Block deleted");
              router.replace("/organisation");
            },
            onError: (e) => {
              toast.error((e as Error).message);
              setConfirmDelete(false);
            },
          })
        }
      />
    </div>
  );
}
