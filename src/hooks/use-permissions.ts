"use client";

import { useMe } from "@/hooks/use-auth";
import type { CurrentUser } from "@/types/org";

/** Areas of the app, each gated on the person's access level. */
export type Module = "dashboard" | "organisation" | "surveys" | "tasks" | "question_bank" | "reports" | "users" | "settings";

/** Modules a plain member can open. Administrators pass every check. */
const MEMBER_MODULES: Module[] = ["dashboard", "organisation", "surveys", "tasks"];

/** UX only -- the API re-checks the role on every request. */
export function canAccess(user: CurrentUser | undefined, module: Module): boolean {
  if (!user) return false;
  return user.role === "admin" || MEMBER_MODULES.includes(module);
}

export function usePermissions() {
  const me = useMe();
  return {
    isPending: me.isPending,
    user: me.data,
    isAdmin: me.data?.role === "admin",
    can: (module: Module) => canAccess(me.data, module),
  };
}
