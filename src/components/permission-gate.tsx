"use client";

import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions, type Module } from "@/hooks/use-permissions";

/**
 * UX-only. Denial is rendered so the sidebar and header stay visible --
 * a blocked user is not stranded on a blank page. The server's
 * HasPermission check is the real boundary; this only hides a button the
 * caller cannot use.
 */
export function PermissionGate({
  module,
  featureName,
  children,
}: {
  module: Module;
  featureName: string;
  children: React.ReactNode;
}) {
  const perms = usePermissions();

  if (perms.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!perms.can(module)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="You don't have access to this"
        description={`Ask an administrator for access to ${featureName}.`}
      />
    );
  }

  return <>{children}</>;
}
