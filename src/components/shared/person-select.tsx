"use client";

import { Select } from "@/components/ui/select";
import { usePeople } from "@/hooks/use-people";
import { useUnits } from "@/hooks/use-units";
import { unitPath } from "@/lib/org";

/** A picker for a person in the workspace, showing the block they sit in. */
export function PersonSelect({
  value,
  onChange,
  placeholder = "Not assigned",
  disabledIds,
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** People already chosen elsewhere; greyed out so one person can't hold two roles. */
  disabledIds?: string[];
}) {
  const people = usePeople();
  const units = useUnits();
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {(people.data ?? [])
        .filter((p) => p.is_active)
        .map((p) => (
          <option key={p.id} value={p.id} disabled={disabledIds?.includes(p.id) && p.id !== value}>
            {p.full_name} — {unitPath(units.data ?? [], p.unit?.id).split(" › ").pop() || "no block"}
          </option>
        ))}
    </Select>
  );
}
