"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { defaultChildKind, unitPath } from "@/lib/org";
import { unitKindLabel, type OrgUnit } from "@/types/org";
import { useSurveyList } from "@/hooks/use-surveys";
import { useUnitMembers } from "../_hooks/use-organisation";
import { KIND_TONE } from "./unit-card";
import type { UnitDraft } from "./unit-form-dialog";

/** The right-hand panel for the selected block: who is in it, which surveys
 * are aimed at it, and (for admins) add / edit / delete. */
export function UnitDrawer({
  unit,
  units,
  isAdmin,
  onClose,
  onEdit,
  onDelete,
}: {
  unit: OrgUnit | null;
  units: OrgUnit[];
  isAdmin: boolean;
  onClose: () => void;
  onEdit: (draft: UnitDraft) => void;
  onDelete: () => void;
}) {
  const members = useUnitMembers(unit?.id ?? null);
  const surveys = useSurveyList({ target_unit: unit?.id, page_size: 50 }, unit !== null);

  return (
    <Dialog open={unit !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="right">
        {unit && (
          <>
            <DialogHeader>
              <Badge tone={KIND_TONE[unit.kind]}>{unitKindLabel(unit.kind)}</Badge>
              <DialogTitle className="mt-2">{unit.name}</DialogTitle>
              <p className="mt-0.5 text-xs text-ink-faint">{unitPath(units, unit.id)}</p>
            </DialogHeader>
            <DialogBody className="space-y-5">
              {isAdmin && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => onEdit({ parent_id: unit.id, name: "", kind: defaultChildKind(unit.kind), head_id: "" })}>
                    <Plus className="h-3.5 w-3.5" /> Add child
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onEdit({ id: unit.id, parent_id: unit.parent_id, name: unit.name, kind: unit.kind, head_id: unit.head?.id ?? "" })}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  {unit.parent_id && (
                    <Button size="sm" variant="ghost" onClick={onDelete}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  )}
                </div>
              )}

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Members ({members.data?.count ?? unit.member_count})</h3>
                {members.data?.results.length === 0 ? (
                  <p className="text-sm text-ink-muted">No one is placed in this block.</p>
                ) : (
                  <ul className="space-y-2">
                    {members.data?.results.map((m) => (
                      <li key={m.id} className="flex items-center gap-2 text-sm">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong">
                          {m.full_name.charAt(0)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-ink">
                            {m.full_name}
                            {m.id === unit.head?.id && <span className="ml-1.5 text-xs text-amber">head</span>}
                          </span>
                          <span className="block truncate text-xs text-ink-faint">{m.title}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  Surveys aimed here ({surveys.data?.count ?? 0})
                </h3>
                {surveys.data?.results.length === 0 ? (
                  <p className="text-sm text-ink-muted">None yet.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-ink">
                    {surveys.data?.results.map((s) => (
                      <li key={s.id}>• {s.title}</li>
                    ))}
                  </ul>
                )}
              </div>
            </DialogBody>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
