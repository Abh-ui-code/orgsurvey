import type { Person } from "@/types/common";
import type { OrgUnit, UnitKind } from "@/types/org";
import type { WorkflowRole } from "@/types/survey";

export interface UnitNode extends OrgUnit {
  children: UnitNode[];
}

/** Builds the forest from the flat list. A well-formed org has one root, but
 * orphans are surfaced as extra roots rather than silently dropped. */
export function buildTree(units: OrgUnit[]): UnitNode[] {
  const byId = new Map<string, UnitNode>(units.map((u) => [u.id, { ...u, children: [] }]));
  const roots: UnitNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function descendantIds(units: OrgUnit[], id: string): string[] {
  const out: string[] = [];
  const walk = (parent: string) => {
    for (const u of units) {
      if (u.parent_id === parent) {
        out.push(u.id);
        walk(u.id);
      }
    }
  };
  walk(id);
  return out;
}

/** "Acme › Technology › Engineering" for a unit. */
export function unitPath(units: OrgUnit[], id: string | null | undefined): string {
  const names: string[] = [];
  let cur = id ? units.find((u) => u.id === id) : undefined;
  while (cur) {
    names.unshift(cur.name);
    cur = cur.parent_id ? units.find((u) => u.id === cur!.parent_id) : undefined;
  }
  return names.join(" › ");
}

/** Units in tree order with their depth, for indented <select> options. */
export function flattenWithDepth(units: OrgUnit[]): { unit: OrgUnit; depth: number }[] {
  const out: { unit: OrgUnit; depth: number }[] = [];
  const walk = (nodes: UnitNode[], depth: number) => {
    for (const n of nodes) {
      out.push({ unit: n, depth });
      walk(n.children, depth + 1);
    }
  };
  walk(buildTree(units), 0);
  return out;
}

/** The kind a new child block should default to, one level below its parent. */
export function defaultChildKind(parentKind: UnitKind): UnitKind {
  if (parentKind === "organisation") return "division";
  if (parentKind === "division") return "department";
  return "team";
}

export interface RoleHolder {
  person: Person;
  /** The block whose head this person is. */
  unit: OrgUnit;
}

/**
 * Suggests who should handle a survey aimed at `targetId`, from the
 * hierarchy: the head of the block itself responds, the head one level up
 * reviews, and the head above that approves. A head who is already used
 * (the same person heading two levels) or who isn't active is skipped, so
 * the three are always different people. Fewer than three are returned if
 * the chain runs out.
 */
export function suggestRoleHolders(
  units: OrgUnit[],
  targetId: string,
  activeIds: Set<string>,
): Partial<Record<WorkflowRole, RoleHolder>> {
  const roles: WorkflowRole[] = ["responder", "reviewer", "approver"];
  const used = new Set<string>();
  const out: Partial<Record<WorkflowRole, RoleHolder>> = {};
  let unit = units.find((u) => u.id === targetId);
  while (unit && Object.keys(out).length < roles.length) {
    const head = unit.head;
    if (head && activeIds.has(head.id) && !used.has(head.id)) {
      used.add(head.id);
      out[roles[Object.keys(out).length]] = { person: head, unit };
    }
    unit = unit.parent_id ? units.find((u) => u.id === unit!.parent_id) : undefined;
  }
  return out;
}
