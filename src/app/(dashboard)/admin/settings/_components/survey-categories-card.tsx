"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CategoryBadge } from "@/components/shared/category-badge";
import { FormDialog } from "@/components/shared/form-dialog";
import { IconButton } from "@/components/shared/icon-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DrawerField } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSurveyCategories } from "@/hooks/use-survey-categories";
import { CATEGORY_COLORS, type CategoryColor, type SurveyCategory } from "@/types/survey";
import { useDeleteSurveyCategory, useSaveSurveyCategory } from "../_hooks/use-settings";
import { cn } from "@/lib/utils";

const SWATCH: Record<CategoryColor, string> = {
  brand: "bg-brand",
  amber: "bg-amber",
  moss: "bg-moss",
  rust: "bg-rust",
  slate: "bg-slate",
};

interface Draft {
  id?: string;
  label: string;
  description: string;
  color: CategoryColor;
  is_active: boolean;
}

/** The topics surveys are filed under (Employee Engagement, Compliance, ...). */
export function SurveyCategoriesCard() {
  const categories = useSurveyCategories();
  const save = useSaveSurveyCategory();
  const del = useDeleteSurveyCategory();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<SurveyCategory | null>(null);
  const fail = (e: Error) => toast.error(e.message);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Survey categories</CardTitle>
          <CardDescription className="mt-1">The topics surveys are filed under. Switch one off to hide it from new surveys.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setDraft({ label: "", description: "", color: "brand", is_active: true })}>
          <Plus className="h-4 w-4" /> Add category
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {categories.isPending ? (
          <Skeleton className="m-5 h-24" />
        ) : (
          <ul className="divide-y divide-line">
            {categories.data?.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <CategoryBadge label={c.label} color={c.color} />
                    {!c.is_active && <span className="text-xs text-ink-faint">Off</span>}
                  </div>
                  {c.description && <p className="mt-1 truncate text-xs text-ink-muted">{c.description}</p>}
                </div>
                <span className="shrink-0 text-xs text-ink-faint">{c.survey_count} survey(s)</span>
                <Switch
                  checked={c.is_active}
                  aria-label={`${c.label} active`}
                  onCheckedChange={(checked) => save.mutate({ id: c.id, label: c.label, is_active: checked }, { onError: fail })}
                />
                <IconButton label={`Edit ${c.label}`} onClick={() => setDraft({ id: c.id, label: c.label, description: c.description, color: c.color, is_active: c.is_active })}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton label={`Delete ${c.label}`} onClick={() => setToDelete(c)}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <FormDialog
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? "Edit category" : "Add category"}
        submitDisabled={!draft?.label.trim()}
        saving={save.isPending}
        onSubmit={() =>
          draft &&
          save.mutate(draft, {
            onSuccess: () => {
              toast.success("Category saved");
              setDraft(null);
            },
            onError: fail,
          })
        }
      >
        {draft && (
          <>
            <DrawerField label="Name" required>
              <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} autoFocus />
            </DrawerField>
            <DrawerField label="Description">
              <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </DrawerField>
            <DrawerField label="Colour">
              <div className="flex gap-2">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    onClick={() => setDraft({ ...draft, color })}
                    className={cn("h-7 w-7 rounded-full ring-offset-2 ring-offset-paper-raised", SWATCH[color], draft.color === color && "ring-2 ring-ink")}
                  />
                ))}
              </div>
            </DrawerField>
          </>
        )}
      </FormDialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        variant="danger"
        title={`Delete “${toDelete?.label}”?`}
        description={
          toDelete && toDelete.survey_count > 0
            ? `${toDelete.survey_count} survey(s) use it, so it can't be deleted. Switch it off instead.`
            : "This cannot be undone."
        }
        confirmLabel="Delete"
        loading={del.isPending}
        onConfirm={() =>
          toDelete &&
          del.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success("Category deleted");
              setToDelete(null);
            },
            onError: (e) => {
              toast.error((e as Error).message);
              setToDelete(null);
            },
          })
        }
      />
    </Card>
  );
}
