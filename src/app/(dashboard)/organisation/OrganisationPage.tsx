"use client";

import { Network, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/use-permissions";
import { useUnits } from "@/hooks/use-units";
import { buildTree } from "@/lib/org";
import { OrgChart } from "./_components/org-chart";
import { UnitFormDialog, type UnitDraft } from "./_components/unit-form-dialog";

export default function OrganisationPage() {
  const units = useUnits();
  const { isAdmin } = usePermissions();
  const router = useRouter();
  const [form, setForm] = useState<UnitDraft | null>(null);

  const roots = useMemo(() => buildTree(units.data ?? []), [units.data]);

  return (
    <div>
      <PageHeader
        title="Organisation"
        description="The hierarchy surveys are aimed at. Open a block to see its members and surveys, and to manage it."
        actions={
          isAdmin &&
          roots.length === 0 && (
            <Button onClick={() => setForm({ parent_id: null, name: "", kind: "organisation", head_id: "" })}>
              <Plus className="h-4 w-4" /> Create organisation
            </Button>
          )
        }
      />

      {units.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : roots.length === 0 ? (
        <EmptyState icon={Network} title="No organisation yet" description="Create the root block to start building the hierarchy." />
      ) : (
        <OrgChart roots={roots} units={units.data ?? []} selectedId={null} onSelect={(id) => router.push(`/organisation/${id}`)} />
      )}

      <UnitFormDialog draft={form} units={units.data ?? []} onClose={() => setForm(null)} />
    </div>
  );
}
