import { Crown, Pencil, Trash2, Users } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { UNIT_KINDS, type OrgUnit, type UnitKind } from "@/types/org";
import { useDeleteUnit, useSaveUnit } from "../_hooks/use-organisation";

export const KIND_TONE: Record<UnitKind, "brand" | "moss" | "amber" | "neutral"> = {
  organisation: "brand",
  division: "moss",
  department: "amber",
  team: "neutral",
};

/** One block in the chart: its type, name, head and head-count. Administrators
 * can rename it in place: double-click the name or use the pencil. Enter (or
 * clicking away) saves, Escape cancels. */
export function UnitCard({
  unit,
  selected,
  canEdit,
  hasChildren,
  onSelect,
}: {
  unit: OrgUnit;
  selected: boolean;
  canEdit: boolean;
  hasChildren: boolean;
  onSelect: () => void;
}) {
  const save = useSaveUnit();
  const del = useDeleteUnit();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(unit.name);
  const finished = useRef(false);

  function start() {
    finished.current = false;
    setName(unit.name);
    setEditing(true);
  }

  function commit() {
    if (finished.current) return;
    finished.current = true;
    const next = name.trim();
    if (!next || next === unit.name) return setEditing(false);
    save.mutate(
      { id: unit.id, parent_id: unit.parent_id, name: next, kind: unit.kind, head_id: unit.head?.id ?? null },
      {
        onSuccess: () => {
          toast.success("Block renamed");
          setEditing(false);
        },
        onError: (e) => {
          finished.current = false;
          toast.error((e as Error).message);
        },
      },
    );
  }

  return (
    <div className="group relative">
      <button
        type="button"
        id={`unit-${unit.id}`}
        onClick={onSelect}
        className={cn(
          "w-52 rounded-lg border bg-paper-raised p-3 text-left transition-shadow hover:shadow-md",
          selected ? "border-brand ring-2 ring-brand/30" : "border-line",
        )}
      >
        <Badge tone={KIND_TONE[unit.kind]}>{UNIT_KINDS.find((k) => k.value === unit.kind)?.label}</Badge>
        {editing ? (
          <span className="mt-2 block h-8" />
        ) : (
          <div className="mt-2 text-sm font-semibold text-ink" onDoubleClick={canEdit ? start : undefined} title={canEdit ? "Double-click to rename" : undefined}>
            {unit.name}
          </div>
        )}
        <div className="mt-1.5 flex items-center justify-between text-xs text-ink-muted">
          <span className="flex items-center gap-1 truncate">
            <Crown className="h-3 w-3 shrink-0" />
            <span className="truncate">{unit.head?.full_name ?? "No head"}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Users className="h-3 w-3" />
            {unit.member_count}
          </span>
        </div>
      </button>
      {editing && (
        <Input
          autoFocus
          value={name}
          disabled={save.isPending}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              finished.current = true;
              setEditing(false);
            }
          }}
          aria-label={`Rename ${unit.name}`}
          className="absolute left-3 right-3 top-[2.9rem] h-8"
        />
      )}
      {canEdit && !editing && (
        <div className="absolute right-2 top-2 hidden items-center gap-0.5 focus-within:flex group-hover:flex">
          <button
            type="button"
            onClick={start}
            aria-label={`Rename ${unit.name}`}
            title="Rename"
            className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint hover:bg-paper-sunken hover:text-brand"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {unit.parent_id !== null && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`Delete ${unit.name}`}
              title="Delete"
              className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint hover:bg-rust-soft hover:text-rust"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        variant="danger"
        title={`Delete “${unit.name}”?`}
        description={
          hasChildren
            ? "This block still has child blocks. Move or delete them first."
            : "Its members move up to the parent block. This cannot be undone."
        }
        confirmLabel="Delete"
        loading={del.isPending}
        onConfirm={() => {
          if (hasChildren) return setConfirming(false);
          del.mutate(unit.id, {
            onSuccess: () => {
              toast.success("Block deleted");
              setConfirming(false);
            },
            onError: (e) => {
              toast.error((e as Error).message);
              setConfirming(false);
            },
          });
        }}
      />
    </div>
  );
}
