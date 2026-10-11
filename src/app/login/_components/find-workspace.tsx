"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { baseDomain, workspaceUrl } from "@/lib/tenant";

/** Bare host (localhost): no workspace yet, so ask which one to open. */
export function FindWorkspace() {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    const subdomain = name.trim().toLowerCase();
    if (!subdomain) return;
    setBusy(true);
    setError("");
    try {
      await api.get("/workspaces/lookup/", { subdomain }, { auth: false });
      window.location.href = workspaceUrl(subdomain, "/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't look that up.");
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4 rounded-lg border border-line bg-paper-raised p-6" onSubmit={go}>
      <div>
        <h1 className="text-lg font-semibold text-ink">Find your workspace</h1>
        <p className="mt-1 text-sm text-ink-muted">Enter your organisation&apos;s workspace name to sign in.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="workspace">Workspace</Label>
        <div className="flex items-center gap-2">
          <Input id="workspace" value={name} onChange={(e) => setName(e.target.value)} placeholder="abc" autoFocus />
          <span className="shrink-0 text-sm text-ink-muted">.{baseDomain()}</span>
        </div>
      </div>
      {error && <p className="text-sm text-rust">{error}</p>}
      <Button type="submit" className="w-full" loading={busy} disabled={!name.trim()}>
        Continue
      </Button>
    </form>
  );
}
