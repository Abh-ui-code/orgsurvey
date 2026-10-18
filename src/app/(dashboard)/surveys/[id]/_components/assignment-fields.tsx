"use client";

import { PersonSelect } from "@/components/shared/person-select";
import { DrawerField } from "@/components/ui/drawer-form";
import { WORKFLOW_ROLES, type WorkflowRole } from "@/types/survey";

export type People = Record<WorkflowRole, string>;

/** The role pickers (all three while drafting, reviewer and approver once live).
 * A person already chosen for one role is greyed out in the others, so the same
 * person can't hold two roles. */
export function AssignmentFields({
  people,
  onChange,
  roles = WORKFLOW_ROLES.map((r) => r.value),
  className = "space-y-3",
}: {
  people: People;
  onChange: (next: People) => void;
  roles?: WorkflowRole[];
  className?: string;
}) {
  const chosen = Object.values(people).filter(Boolean);
  return (
    <div className={className}>
      {WORKFLOW_ROLES.filter((r) => roles.includes(r.value)).map((role) => (
        <DrawerField key={role.value} label={role.label} hint={role.description}>
          <PersonSelect value={people[role.value]} onChange={(id) => onChange({ ...people, [role.value]: id })} disabledIds={chosen} />
        </DrawerField>
      ))}
    </div>
  );
}
