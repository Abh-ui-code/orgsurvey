import { Crown, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UNIT_KINDS, type OrgUnit, type UnitKind } from "@/types/org";

export const KIND_TONE: Record<UnitKind, "brand" | "moss" | "amber" | "neutral"> = {
  organisation: "brand",
  division: "moss",
  department: "amber",
  team: "neutral",
};

/** One block in the chart: its type, name, head and head-count. */
export function UnitCard({ unit, selected, onSelect }: { unit: OrgUnit; selected: boolean; onSelect: () => void }) {
  return (
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
      <div className="mt-2 text-sm font-semibold text-ink">{unit.name}</div>
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
  );
}
