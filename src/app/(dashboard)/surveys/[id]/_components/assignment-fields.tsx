"use client";

import { PersonSelect } from "@/components/shared/person-select";
import { DrawerField } from "@/components/ui/drawer-form";
import { WORKFLOW_ROLES, type WorkflowRole } from "@/types/survey";

export type People = Record<WorkflowRole, string>;

/** The three role pickers. A person already chosen for one role is greyed
 * out in the other two, so the same person can't hold two roles. */
export function AssignmentFields({ people, onChange }: { people: People; onChange: (next: People) => void }) {
  const chosen = Object.values(people).filter(Boolean);
  return (
    <div className="space-y-3">
      {WORKFLOW_ROLES.map((role) => (
        <DrawerField key={role.value} label={role.label} hint={role.description}>
          <PersonSelect value={people[role.value]} onChange={(id) => onChange({ ...people, [role.value]: id })} disabledIds={chosen} />
        </DrawerField>
      ))}
    </div>
  );
}
