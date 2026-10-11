"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/shared/form-dialog";
import { PersonSelect } from "@/components/shared/person-select";
import { UnitSelect } from "@/components/shared/unit-select";
import { DrawerField } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { descendantIds } from "@/lib/org";
import { UNIT_KINDS, type OrgUnit, type UnitKind } from "@/types/org";
import { useSaveUnit } from "../_hooks/use-organisation";

export interface UnitDraft {
  id?: string;
  parent_id: string | null;
  name: string;
  kind: UnitKind;
  head_id: string;
}

/** Add a block, or edit one. `draft` is null when closed. */
export function UnitFormDialog({ draft, units, onClose }: { draft: UnitDraft | null; units: OrgUnit[]; onClose: () => void }) {
  const save = useSaveUnit();
  const [value, setValue] = useState<UnitDraft | null>(draft);
  const [seen, setSeen] = useState(draft);
  if (draft !== seen) {
    setSeen(draft);
    setValue(draft);
  }

  // A block can't move under itself or one of its own children.
  const blocked = useMemo(
    () => (value?.id ? new Set([value.id, ...descendantIds(units, value.id)]) : new Set<string>()),
    [value?.id, units],
  );
  const isRoot = value?.parent_id === null;

  return (
    <FormDialog
      open={draft !== null}
      onOpenChange={(o) => !o && onClose()}
      title={value?.id ? "Edit block" : "Add block"}
      saving={save.isPending}
      submitDisabled={!value?.name.trim()}
      onSubmit={() =>
        value &&
        save.mutate(
          { id: value.id, parent_id: value.parent_id, name: value.name, kind: value.kind, head_id: value.head_id || null },
          {
            onSuccess: () => {
              toast.success(value.id ? "Block updated" : "Block added");
              onClose();
            },
            onError: (e) => toast.error((e as Error).message),
          },
        )
      }
    >
      {value && (
        <>
          <DrawerField label="Name" required>
            <Input value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} autoFocus />
          </DrawerField>
          <DrawerField label="Type">
            <Select value={value.kind} onChange={(e) => setValue({ ...value, kind: e.target.value as UnitKind })}>
              {UNIT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
          </DrawerField>
          {!isRoot && (
            <DrawerField label="Reports to" hint="The block above this one in the hierarchy.">
              <UnitSelect value={value.parent_id ?? ""} onChange={(id) => setValue({ ...value, parent_id: id })} hideIds={blocked} />
            </DrawerField>
          )}
          <DrawerField label="Head of block">
            <PersonSelect value={value.head_id} onChange={(id) => setValue({ ...value, head_id: id })} placeholder="No head" />
          </DrawerField>
        </>
      )}
    </FormDialog>
  );
}
