"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/hooks/use-auth";
import { useWorkspaceInfo } from "@/hooks/use-workspace";
import { platformUrl } from "@/lib/tenant";

/** Sign in to the workspace named by the address bar. */
export function SignInForm({ tenant }: { tenant: string }) {
  const login = useLogin();
  const workspace = useWorkspaceInfo();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (workspace.isError) {
    return (
      <div className="space-y-3 rounded-xl border border-line bg-paper-raised p-6 shadow-card">
        <h1 className="font-display text-2xl font-semibold text-ink">Workspace not available</h1>
        <p className="text-sm text-ink-muted">{(workspace.error as Error).message}</p>
        <Button asChild variant="secondary" className="w-full">
          <a href={platformUrl("/login")}>Find another workspace</a>
        </Button>
      </div>
    );
  }

  return (
    <>
      <form
        className="space-y-4 rounded-xl border border-line bg-paper-raised p-6 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate({ email, password });
        }}
      >
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-ink-muted">
            to <span className="font-medium text-ink">{workspace.data?.name ?? tenant}</span>
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {login.isError && <p className="text-sm text-rust">{(login.error as Error).message}</p>}
        <Button type="submit" className="w-full" loading={login.isPending}>
          Sign in
        </Button>
        <p className="text-center text-xs text-ink-faint">
          Not your workspace?{" "}
          <a className="text-brand hover:underline" href={platformUrl("/login")}>
            Switch
          </a>
        </p>
      </form>

    </>
  );
}
