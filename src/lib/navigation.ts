import {
  BookOpen,
  ClipboardCheck,
  FileSpreadsheet,
  LayoutDashboard,
  ListChecks,
  Network,
  ShieldCheck,
  Sliders,
  Users2,
  type LucideIcon,
} from "lucide-react";
import type { Module } from "@/hooks/use-permissions";

export interface NavLeaf {
  kind: "leaf";
  href: string;
  label: string;
  icon: LucideIcon;
  module: Module;
}

export interface NavGroup {
  kind: "group";
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavLeaf[];
}

export type NavEntry = NavLeaf | NavGroup;

function leaf(href: string, label: string, icon: LucideIcon, module: Module): NavLeaf {
  return { kind: "leaf", href, label, icon, module };
}

/** Every leaf names the module it gates on; filtering happens once, in AppShell. */
export const NAV: NavEntry[] = [
  leaf("/", "Dashboard", LayoutDashboard, "dashboard"),
  leaf("/tasks", "My tasks", ClipboardCheck, "tasks"),
  leaf("/organisation", "Organisation", Network, "organisation"),
  leaf("/surveys", "Surveys", ListChecks, "surveys"),
  leaf("/question-bank", "Question bank", BookOpen, "question_bank"),
  leaf("/reports", "Reports", FileSpreadsheet, "reports"),
  {
    kind: "group",
    id: "administration",
    label: "Administration",
    icon: ShieldCheck,
    items: [
      leaf("/admin/users", "Users", Users2, "users"),
      leaf("/admin/settings", "Settings", Sliders, "settings"),
    ],
  },
];

function flatten(nav: NavEntry[]): NavLeaf[] {
  return nav.flatMap((entry) => (entry.kind === "leaf" ? [entry] : entry.items));
}

export function filterNav(nav: NavEntry[], can: (module: Module) => boolean): NavEntry[] {
  return nav
    .filter((entry) => entry.kind !== "leaf" || can(entry.module))
    .map((entry) => (entry.kind === "leaf" ? entry : { ...entry, items: entry.items.filter((i) => can(i.module)) }))
    .filter((entry) => entry.kind === "leaf" || entry.items.length > 0);
}

/** The single longest matching href, so `/surveys/new` doesn't light up `/`. */
export function activeNavHref(pathname: string, nav: NavEntry[]): string | null {
  let best: string | null = null;
  for (const item of flatten(nav)) {
    if (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) {
      if (!best || item.href.length > best.length) best = item.href;
    }
  }
  return best;
}
