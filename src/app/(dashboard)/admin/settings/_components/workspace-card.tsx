"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DrawerField } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceSettings } from "@/hooks/use-workspace";
import { useUpdateWorkspaceSettings } from "../_hooks/use-settings";

export function WorkspaceCard() {
  const settings = useWorkspaceSettings();
  const update = useUpdateWorkspaceSettings();
  // Edits are kept apart from the saved values, so the form shows the saved
  // ones until the person starts typing.
  const [orgName, setOrgName] = useState<string | null>(null);
  const [days, setDays] = useState<string | null>(null);

  if (settings.isPending || !settings.data) return <Skeleton className="h-48 w-full" />;
  const name = orgName ?? settings.data.org_name;
  const dueDays = days ?? String(settings.data.default_due_days);
  const valid = name.trim() && Number(dueDays) >= 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <DrawerField label="Organisation name" required>
          <Input value={name} onChange={(e) => setOrgName(e.target.value)} />
        </DrawerField>
        <DrawerField label="Default due date (days)" hint="New surveys are due this many days after creation.">
          <Input type="number" min={1} value={dueDays} onChange={(e) => setDays(e.target.value)} />
        </DrawerField>
        <div className="flex justify-end">
          <Button
            disabled={!valid}
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                { org_name: name.trim(), default_due_days: Math.floor(Number(dueDays)) },
                { onSuccess: () => toast.success("Settings saved"), onError: (e) => toast.error((e as Error).message) },
              )
            }
          >
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
