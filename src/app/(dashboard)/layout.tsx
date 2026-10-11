"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useMe } from "@/hooks/use-auth";

/** The one place AppShell is mounted. Every route in this group is
 * authenticated; a failed `me` lookup redirects to login once, here. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const router = useRouter();

  useEffect(() => {
    if (me.isError) router.replace("/login");
  }, [me.isError, router]);

  if (me.isPending || me.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
