"use client";

import { PersonSelect } from "@/components/shared/person-select";
import { DrawerField } from "@/components/ui/drawer-form";
import { WORKFLOW_ROLES, type WorkflowRole } from "@/types/survey";

export type People = Record<WorkflowRole, string>;

/** The role pickers (all three while drafting, reviewer and approver once live).
 * The reviewer and the approver must be different people, so each is greyed out for the other.
 * A respondent may be the reviewer. */
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
  const taken = (role: WorkflowRole) => (role === "reviewer" ? [people.approver] : role === "approver" ? [people.reviewer] : []).filter(Boolean);
  return (
    <div className={className}>
      {WORKFLOW_ROLES.filter((r) => roles.includes(r.value)).map((role) => (
        <DrawerField key={role.value} label={role.label} hint={role.description}>
          <PersonSelect value={people[role.value]} onChange={(id) => onChange({ ...people, [role.value]: id })} disabledIds={taken(role.value)} />
        </DrawerField>
      ))}
    </div>
  );
}
