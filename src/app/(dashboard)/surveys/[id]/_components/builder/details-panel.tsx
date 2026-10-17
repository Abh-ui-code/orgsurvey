"use client";

import { Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { UnitSelect } from "@/components/shared/unit-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DrawerField, DrawerSection } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePeople } from "@/hooks/use-people";
import { useSurveyCategories } from "@/hooks/use-survey-categories";
import { useUnits } from "@/hooks/use-units";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";
import { suggestRoleHolders } from "@/lib/org";
import { WORKFLOW_ROLES, type SurveyDetail } from "@/types/survey";
import { useUpdateSurvey } from "../../_hooks/use-survey-actions";
import { AssignmentFields, type People } from "../assignment-fields";

/** The editable fields of a draft, in the shape the form holds them. */
function formOf(s: SurveyDetail) {
  return {
    title: s.title,
    category_id: s.category.id,
    target_unit_id: s.target_unit.id,
    description: s.description,
    instructions: s.instructions,
    due_date: s.due_date ?? "",
    people: {
      responder: s.responder?.id ?? "",
      reviewer: s.reviewer?.id ?? "",
      approver: s.approver?.id ?? "",
    } satisfies People,
  };
}

/** Details and assignment of a draft, saved together. `dirty` is reported up
 * so the publish button can ask for a save first. */
export function DetailsPanel({ survey, onDirtyChange }: { survey: SurveyDetail; onDirtyChange: (dirty: boolean) => void }) {
  const categories = useSurveyCategories();
  const update = useUpdateSurvey(survey.id);
  const [form, setForm] = useState(() => formOf(survey));

  const dirty = JSON.stringify(form) !== JSON.stringify(formOf(survey));
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useUnsavedChangesWarning(dirty);

  // The org chart already says who should handle a survey aimed at this block.
  const units = useUnits();
  const people = usePeople();
  const suggestion = useMemo(
    () => suggestRoleHolders(units.data ?? [], form.target_unit_id, new Set((people.data ?? []).filter((p) => p.is_active).map((p) => p.id))),
    [units.data, people.data, form.target_unit_id],
  );
  const suggested = WORKFLOW_ROLES.filter((r) => suggestion[r.value]);
  const applySuggestion = () => {
    setForm({
      ...form,
      people: {
        responder: suggestion.responder?.person.id ?? "",
        reviewer: suggestion.reviewer?.person.id ?? "",
        approver: suggestion.approver?.person.id ?? "",
      },
    });
    toast.success("Filled from the org chart. Adjust anyone you like, then save.");
  };

  const patch = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm({ ...form, [key]: value });
  // The survey's own category stays selectable even if it has since been switched off.
  const selectable = (categories.data ?? []).filter((c) => c.is_active || c.id === survey.category.id);

  function save() {
    update.mutate(
      {
        title: form.title,
        category_id: form.category_id,
        target_unit_id: form.target_unit_id,
        description: form.description,
        instructions: form.instructions,
        due_date: form.due_date || null,
        responder_id: form.people.responder || null,
        reviewer_id: form.people.reviewer || null,
        approver_id: form.people.approver || null,
      },
      {
        onSuccess: () => toast.success("Saved"),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details &amp; assignment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <DrawerSection title="Details">
          <div className="grid gap-4 md:grid-cols-2">
            <DrawerField label="Title" required>
              <Input value={form.title} onChange={(e) => patch("title", e.target.value)} />
            </DrawerField>
            <DrawerField label="Category" required>
              <Select value={form.category_id} onChange={(e) => patch("category_id", e.target.value)}>
                {selectable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </DrawerField>
            <DrawerField label="Aimed at" required hint="The org block this survey is about.">
              <UnitSelect value={form.target_unit_id} onChange={(id) => patch("target_unit_id", id)} />
            </DrawerField>
            <DrawerField label="Description" hint="For admins. Respondents see the instructions below.">
              <Textarea rows={2} value={form.description} onChange={(e) => patch("description", e.target.value)} />
            </DrawerField>
            <DrawerField label="Instructions" hint="Shown to the respondent above the questions.">
              <Textarea rows={2} value={form.instructions} onChange={(e) => patch("instructions", e.target.value)} />
            </DrawerField>
          </div>
        </DrawerSection>

        <DrawerSection title="Assignment">
          <div className="rounded-md border border-dashed border-line-strong p-3">
            <Button type="button" variant="secondary" size="sm" onClick={applySuggestion} disabled={suggested.length === 0}>
              <Wand2 className="h-3.5 w-3.5" /> Suggest from the org chart
            </Button>
            <p className="mt-2 text-xs text-ink-muted">
              {suggested.length === 0
                ? "No one heads this block or the blocks above it yet. Set heads on the Organisation page to enable suggestions."
                : suggested.map((r) => `${r.label}: ${suggestion[r.value]!.person.full_name} (head of ${suggestion[r.value]!.unit.name})`).join(" · ")}
            </p>
          </div>
          <AssignmentFields className="grid gap-4 md:grid-cols-3" people={form.people} onChange={(p) => patch("people", p)} />
          <DrawerField label="Due date">
            <Input type="date" value={form.due_date} onChange={(e) => patch("due_date", e.target.value)} />
          </DrawerField>
        </DrawerSection>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-ink-faint">{dirty ? "Unsaved changes" : "All changes saved"}</span>
          <Button onClick={save} disabled={!dirty || !form.title.trim()} loading={update.isPending}>
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
