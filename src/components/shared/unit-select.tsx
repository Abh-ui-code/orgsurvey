"use client";

import { Select } from "@/components/ui/select";
import { useUnits } from "@/hooks/use-units";
import { flattenWithDepth } from "@/lib/org";

/** A picker for an org block, indented to show the hierarchy. */
export function UnitSelect({
  value,
  onChange,
  placeholder,
  hideIds,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  /** Adds an empty first option with this label (e.g. "Choose a block"). */
  placeholder?: string;
  /** Blocks that must not be offered (a block can't move under itself). */
  hideIds?: Set<string>;
  className?: string;
}) {
  const units = useUnits();
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {flattenWithDepth(units.data ?? [])
        .filter(({ unit }) => !hideIds?.has(unit.id))
        .map(({ unit, depth }) => (
          <option key={unit.id} value={unit.id}>
            {"  ".repeat(depth)}
            {unit.name}
          </option>
        ))}
    </Select>
  );
}
