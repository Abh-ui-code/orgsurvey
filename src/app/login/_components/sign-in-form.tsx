"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/hooks/use-auth";
import { useWorkspaceInfo } from "@/hooks/use-workspace";
import { baseDomain, platformUrl } from "@/lib/tenant";

const SHOW_DEMO = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS !== "false";
const DEMO_PASSWORD = "devpassword";
const DEMO = [
  { label: "Administrator", user: "admin" },
  { label: "Responder (Neha)", user: "neha" },
  { label: "Reviewer (Vikram)", user: "vikram" },
  { label: "Approver (Anita)", user: "anita" },
];

/** Sign in to the workspace named by the address bar. */
export function SignInForm({ tenant }: { tenant: string }) {
  const login = useLogin();
  const workspace = useWorkspaceInfo();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (workspace.isError) {
    return (
      <div className="space-y-3 rounded-lg border border-line bg-paper-raised p-6">
        <h1 className="text-lg font-semibold text-ink">Workspace not available</h1>
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
        className="space-y-4 rounded-lg border border-line bg-paper-raised p-6"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate({ email, password });
        }}
      >
        <div>
          <h1 className="text-lg font-semibold text-ink">Sign in</h1>
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

      {SHOW_DEMO && (
        <div className="mt-4 rounded-lg border border-dashed border-line-strong p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Demo accounts</p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO.map((d) => (
              <Button
                key={d.user}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEmail(`${d.user}@${tenant}.${baseDomain()}`);
                  setPassword(DEMO_PASSWORD);
                }}
              >
                {d.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
