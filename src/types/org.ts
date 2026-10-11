import type { Person, Ref } from "@/types/common";

export type UnitKind = "organisation" | "division" | "department" | "team";

export const UNIT_KINDS: { value: UnitKind; label: string }[] = [
  { value: "organisation", label: "Organisation" },
  { value: "division", label: "Division" },
  { value: "department", label: "Department" },
  { value: "team", label: "Team" },
];

export function unitKindLabel(kind: UnitKind): string {
  return UNIT_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

/** One block in the org hierarchy. `parent_id === null` marks the root. */
export interface OrgUnit {
  id: string;
  parent_id: string | null;
  name: string;
  kind: UnitKind;
  head: Person | null;
  member_count: number;
}

export type UserRole = "admin" | "member";

/** A person in this workspace. The id is the person's own user id. */
export interface OrgUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  title: string;
  unit: Ref | null;
  is_active: boolean;
}

/** The signed-in person, plus the workspace they are in. */
export interface CurrentUser extends OrgUser {
  tenant: { name: string; subdomain: string };
}
