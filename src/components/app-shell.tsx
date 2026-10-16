"use client";

import { ChevronDown, LogOut, Menu, Settings as SettingsIcon, User, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LogoMark } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboard } from "@/hooks/use-dashboard";
import { useLogout } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useWorkspaceSettings } from "@/hooks/use-workspace";
import { activeNavHref, filterNav, NAV } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  collapsed,
  indent,
  badge,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  collapsed: boolean;
  indent?: boolean;
  /** A count shown at the right (e.g. tasks waiting). Hidden when zero. */
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive ? "bg-sidebar-active text-white" : "text-sidebar-muted hover:bg-sidebar-active/50 hover:text-sidebar-ink",
        collapsed && "justify-center px-0",
        indent && !collapsed && "pl-8",
      )}
      title={collapsed ? label : undefined}
    >
      {isActive && <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-mark" />}
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="flex-1">{label}</span>}
      {badge ? (
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full bg-amber px-1.5 text-2xs font-semibold text-white",
            collapsed && "absolute right-1 top-1 h-4 min-w-4 px-1",
          )}
          aria-label={`${badge} waiting`}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const perms = usePermissions();
  const me = perms.user;
  const settings = useWorkspaceSettings();
  const dashboard = useDashboard();
  const logout = useLogout();
  const [collapsed, setCollapsed] = useState(false); // desktop: icon-only rail
  const [mobileOpen, setMobileOpen] = useState(false); // phone: slide-in drawer
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const visibleNav = useMemo(() => filterNav(NAV, perms.can), [me?.role]); // eslint-disable-line react-hooks/exhaustive-deps
  const activeHref = activeNavHref(pathname, visibleNav);
  const badges: Record<string, number | undefined> = { "/tasks": dashboard.data?.counts.waiting_on_you };

  // Following a link on a phone closes the drawer.
  useEffect(() => setMobileOpen(false), [pathname]);

  // On a phone the drawer is always full-width labels; the icon-only rail is a desktop feature.
  const rail = collapsed && !mobileOpen;

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {mobileOpen && <div className="fixed inset-0 z-30 bg-ink/40 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden />}

      <aside
        className={cn(
          "z-40 flex shrink-0 flex-col border-r border-sidebar-line bg-sidebar text-sidebar-ink transition-all duration-150",
          // phone: off-canvas drawer; desktop: static column
          "fixed inset-y-0 left-0 w-64 -translate-x-full md:static md:translate-x-0",
          mobileOpen && "translate-x-0 shadow-xl",
          collapsed ? "md:w-16" : "md:w-60",
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-line px-4">
          <LogoMark className="h-7 w-7 shrink-0" />
          {!rail && <span className="font-display flex-1 text-base font-semibold text-white">OrgSurvey</span>}
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded p-1 text-sidebar-muted hover:bg-sidebar-active md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {visibleNav.map((entry) => {
            if (entry.kind === "leaf") {
              return (
                <NavLink
                  key={entry.href}
                  href={entry.href}
                  label={entry.label}
                  icon={entry.icon}
                  isActive={entry.href === activeHref}
                  collapsed={rail}
                  badge={badges[entry.href]}
                />
              );
            }
            const isOpen = openGroups[entry.id] ?? true;
            return (
              <div key={entry.id} className="pt-3">
                {!rail && (
                  <button
                    onClick={() => setOpenGroups((g) => ({ ...g, [entry.id]: !isOpen }))}
                    className="flex w-full items-center gap-1.5 rounded-md px-3 pb-1 text-xs font-medium text-sidebar-muted hover:text-sidebar-ink"
                  >
                    <entry.icon className="h-3.5 w-3.5" />
                    <span className="flex-1 text-left">{entry.label}</span>
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !isOpen && "-rotate-90")} />
                  </button>
                )}
                {(isOpen || rail) && (
                  <div className="space-y-0.5">
                    {entry.items.map((item) => (
                      <NavLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        icon={item.icon}
                        isActive={item.href === activeHref}
                        collapsed={rail}
                        indent
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden h-10 items-center justify-center border-t border-sidebar-line text-sidebar-muted hover:bg-sidebar-active/50 hover:text-sidebar-ink md:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu className="h-4 w-4" />
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line bg-paper-raised px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-2 text-ink-muted hover:bg-paper-sunken md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 truncate text-sm text-ink-muted">
              <span className="font-medium text-ink">{settings.data?.org_name ?? " "}</span>
              {me && (
                <span className="hidden sm:inline">
                  <span className="mx-1.5 text-line-strong">/</span>
                  {me.role === "admin" ? "Administrator" : "Member"}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-paper-sunken">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong">
                  {(me?.full_name ?? "?").charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-[160px] truncate text-ink sm:inline">{me?.full_name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="h-4 w-4" /> My profile
                  </Link>
                </DropdownMenuItem>
                {perms.isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/settings">
                      <SettingsIcon className="h-4 w-4" /> Settings
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onClick={() => logout.mutate()}>
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
