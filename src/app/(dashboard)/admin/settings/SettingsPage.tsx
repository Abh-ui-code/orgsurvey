"use client";

import { PermissionGate } from "@/components/permission-gate";
import { PageHeader } from "@/components/ui/page-header";
import { SurveyCategoriesCard } from "./_components/survey-categories-card";
import { WorkspaceCard } from "./_components/workspace-card";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Workspace-level options." />
      <PermissionGate module="settings" featureName="settings">
        <div className="max-w-3xl space-y-4">
          <WorkspaceCard />
          <SurveyCategoriesCard />
        </div>
      </PermissionGate>
    </div>
  );
}
