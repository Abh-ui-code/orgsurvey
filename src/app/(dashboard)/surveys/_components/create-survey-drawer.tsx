"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/shared/form-dialog";
import { UnitSelect } from "@/components/shared/unit-select";
import { DrawerField, DrawerSection } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSurveyCategories } from "@/hooks/use-survey-categories";
import { useCreateSurvey } from "../_hooks/use-surveys";

const EMPTY = { title: "", category_id: "", target_unit_id: "", description: "" };

/** Starts a draft with the few things every survey needs, then opens the
 * builder. Open state is owned here so the trigger can be any button. */
export function CreateSurveyDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState(EMPTY);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm(EMPTY); // every opening starts from a blank form
  }
  const categories = useSurveyCategories();
  const create = useCreateSurvey();
  const router = useRouter();

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New survey"
      side="right"
      submitLabel="Create survey"
      saving={create.isPending}
      submitDisabled={!form.title.trim() || !form.category_id || !form.target_unit_id}
      onSubmit={() =>
        create.mutate(form, {
          onSuccess: (survey) => {
            toast.success("Draft created");
            onOpenChange(false);
            router.push(`/surveys/${survey.id}`);
          },
          onError: (err) => toast.error((err as Error).message),
        })
      }
    >
      <DrawerSection title="Details">
        <DrawerField label="Title" required>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Engineering Team Pulse - Q4" autoFocus />
        </DrawerField>
        <DrawerField label="Category" required>
          <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Choose a category</option>
            {categories.data
              ?.filter((c) => c.is_active)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
          </Select>
        </DrawerField>
        <DrawerField label="Aimed at" required hint="The org block this survey is about.">
          <UnitSelect value={form.target_unit_id} onChange={(id) => setForm({ ...form, target_unit_id: id })} placeholder="Choose a block" />
        </DrawerField>
        <DrawerField label="Description" hint="What this survey is for. You'll add questions, the three people and the due date next.">
          <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </DrawerField>
      </DrawerSection>
    </FormDialog>
  );
}
