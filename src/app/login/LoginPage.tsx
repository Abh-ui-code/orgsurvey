"use client";

import { useEffect, useState } from "react";
import { getTenantFromHost } from "@/lib/tenant";
import { Brand } from "./_components/brand";
import { FindWorkspace } from "./_components/find-workspace";
import { SignInForm } from "./_components/sign-in-form";

export default function LoginPage() {
  // The host is only known in the browser; render nothing until it is.
  const [tenant, setTenant] = useState<string | null | undefined>(undefined);
  useEffect(() => setTenant(getTenantFromHost()), []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <div className="w-full max-w-sm">
        <Brand />
        {tenant === undefined ? null : tenant === null ? <FindWorkspace /> : <SignInForm tenant={tenant} />}
      </div>
    </div>
  );
}
