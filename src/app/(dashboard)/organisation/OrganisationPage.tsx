"use client";

import { Network, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/use-permissions";
import { useUnits } from "@/hooks/use-units";
import { buildTree } from "@/lib/org";
import { OrgChart } from "./_components/org-chart";
import { UnitDrawer } from "./_components/unit-drawer";
import { UnitFormDialog, type UnitDraft } from "./_components/unit-form-dialog";
import { useDeleteUnit } from "./_hooks/use-organisation";

export default function OrganisationPage() {
  const units = useUnits();
  const { isAdmin } = usePermissions();
  const del = useDeleteUnit();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<UnitDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const roots = useMemo(() => buildTree(units.data ?? []), [units.data]);
  const selected = units.data?.find((u) => u.id === selectedId) ?? null;
  const hasChildren = (units.data ?? []).some((u) => u.parent_id === selectedId);

  return (
    <div>
      <PageHeader
        title="Organisation"
        description="The hierarchy surveys are aimed at. Select a block to see its members and manage it."
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
        <OrgChart roots={roots} units={units.data ?? []} selectedId={selectedId} onSelect={setSelectedId} />
      )}

      <UnitDrawer
        unit={selected}
        units={units.data ?? []}
        isAdmin={isAdmin}
        onClose={() => setSelectedId(null)}
        onEdit={setForm}
        onDelete={() => setConfirmDelete(true)}
      />
      <UnitFormDialog draft={form} units={units.data ?? []} onClose={() => setForm(null)} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        variant="danger"
        title={`Delete “${selected?.name}”?`}
        description={
          hasChildren ? "This block still has child blocks. Move or delete them first." : "Its members move up to the parent block. This cannot be undone."
        }
        confirmLabel="Delete"
        loading={del.isPending}
        onConfirm={() =>
          selected &&
          del.mutate(selected.id, {
            onSuccess: () => {
              toast.success("Block deleted");
              setConfirmDelete(false);
              setSelectedId(null);
            },
            onError: (e) => {
              toast.error((e as Error).message);
              setConfirmDelete(false);
            },
          })
        }
      />
    </div>
  );
}
