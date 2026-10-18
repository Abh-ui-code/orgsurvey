"use client";

import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/shared/avatar";
import { PersonSelect } from "@/components/shared/person-select";
import { FormDialog } from "@/components/shared/form-dialog";
import { IconButton } from "@/components/shared/icon-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DrawerField } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { questionTypeLabel } from "@/types/question";
import type { SurveyDetail, SurveySection } from "@/types/survey";
import { useAssignQuestions } from "../../_hooks/use-survey-actions";
import {
  useAddSection,
  useDeleteQuestion,
  useDeleteSection,
  useMoveQuestion,
  useMoveSection,
  useUpdateSection,
} from "../../_hooks/use-survey-builder";
import { QuestionDialog, type QuestionTarget } from "./question-dialog";

interface SectionDraft {
  id?: string;
  title: string;
  description: string;
}

/** The draft's sections and questions: add, edit, reorder, delete. */
export function SectionsEditor({ survey }: { survey: SurveyDetail }) {
  const addSection = useAddSection(survey.id);
  const updateSection = useUpdateSection(survey.id);
  const deleteSection = useDeleteSection(survey.id);
  const moveSection = useMoveSection(survey.id);
  const moveQuestion = useMoveQuestion(survey.id);
  const deleteQuestion = useDeleteQuestion(survey.id);
  const assign = useAssignQuestions(survey.id);

  const [sectionForm, setSectionForm] = useState<SectionDraft | null>(null);
  const [questionTarget, setQuestionTarget] = useState<QuestionTarget | null>(null);
  const [sectionToDelete, setSectionToDelete] = useState<SurveySection | null>(null);

  const fail = (e: Error) => toast.error(e.message);
  const lastSection = survey.sections.length - 1;
  // Reviewer and approver can't answer questions, so they are greyed out in the pickers.
  const handlers = [survey.reviewer?.id, survey.approver?.id].filter(Boolean) as string[];
  // Questions ticked for a bulk assignment, across all sections.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (ids: string[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const everyId = survey.sections.flatMap((sec) => sec.questions.map((q) => q.id));
  const assignPicked = (personId: string) => {
    if (!personId) return;
    const ids = [...picked];
    assign.mutate(ids.map((question_id) => ({ question_id, responder_id: personId })), {
      onSuccess: () => {
        toast.success(`${ids.length} question${ids.length === 1 ? "" : "s"} assigned`);
        setPicked(new Set());
      },
      onError: fail,
    });
  };

  function saveSection() {
    if (!sectionForm) return;
    const done = { onSuccess: () => setSectionForm(null), onError: fail };
    const body = { title: sectionForm.title, description: sectionForm.description };
    if (sectionForm.id) updateSection.mutate({ id: sectionForm.id, ...body }, done);
    else addSection.mutate(body, done);
  }

  return (
    <div className="space-y-4">
      {picked.size > 0 && (
        <div role="region" aria-label="Assign selected questions" className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-brand/40 bg-paper-raised px-4 py-3 shadow-lg">
          <span className="text-sm font-semibold text-brand-strong">{picked.size} selected</span>
          <div className="w-64 max-w-full">
            <PersonSelect value="" placeholder="Assign to respondent…" onChange={assignPicked} disabledIds={handlers} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => toggle(everyId, picked.size < everyId.length)}>
            {picked.size < everyId.length ? "Select all" : "Select none"}
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setPicked(new Set())}>
            Clear
          </Button>
        </div>
      )}
      {survey.sections.map((section, si) => (
        <Card key={section.id}>
          <CardHeader className="items-center py-3">
            <div className="flex min-w-0 items-center gap-2">
              {section.questions.length > 0 && (
                <Checkbox
                  aria-label={`Select every question in ${section.title}`}
                  checked={section.questions.every((q) => picked.has(q.id))}
                  onCheckedChange={(v) => toggle(section.questions.map((q) => q.id), v === true)}
                />
              )}
              <GripVertical className="h-4 w-4 shrink-0 text-ink-faint" />
              <div className="min-w-0">
                <CardTitle>{section.title}</CardTitle>
                {section.description && <p className="mt-0.5 text-xs text-ink-muted">{section.description}</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              <Button variant="ghost" size="sm" onClick={() => setQuestionTarget({ sectionId: section.id })}>
                <Plus className="h-4 w-4" /> Question
              </Button>
              <IconButton label="Move section up" disabled={si === 0} onClick={() => moveSection.mutate({ id: section.id, direction: "up" }, { onError: fail })}>
                <ArrowUp className="h-4 w-4" />
              </IconButton>
              <IconButton label="Move section down" disabled={si === lastSection} onClick={() => moveSection.mutate({ id: section.id, direction: "down" }, { onError: fail })}>
                <ArrowDown className="h-4 w-4" />
              </IconButton>
              <IconButton label="Edit section" onClick={() => setSectionForm({ id: section.id, title: section.title, description: section.description })}>
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton label="Delete section" disabled={survey.sections.length <= 1} onClick={() => setSectionToDelete(section)}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          </CardHeader>
          {section.questions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-faint">No questions in this section yet.</p>
          ) : (
            <ul>
              {section.questions.map((q, qi) => (
                <li key={q.id} className={`flex items-center justify-between gap-4 border-b border-line px-5 py-3 last:border-b-0 ${picked.has(q.id) ? "bg-brand-soft/40" : ""}`}>
                  <Checkbox aria-label={`Select question ${qi + 1}`} checked={picked.has(q.id)} onCheckedChange={(v) => toggle([q.id], v === true)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      {q.text} {q.required && <span className="text-rust">*</span>}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                      <span className="font-mono-data">Q{qi + 1}</span>
                      <span>·</span>
                      <span>{questionTypeLabel(q.type)}</span>
                      {q.bank_question_id && <Badge tone="brand">From bank</Badge>}
                      {q.options.length > 0 && <span className="truncate">· {q.options.join(", ")}</span>}
                    </p>
                    {q.hint && <p className="mt-1 text-xs italic text-ink-muted">{q.hint}</p>}
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs">
                      <span className="text-ink-muted">Respondent</span>
                      {q.responder ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-sunken py-0.5 pl-0.5 pr-2 font-medium text-ink">
                          <Avatar name={q.responder.full_name} className="h-5 w-5 text-2xs" /> {q.responder.full_name}
                        </span>
                      ) : (
                        <span className="font-medium text-rust">Not assigned</span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton label="Move question up" disabled={qi === 0} onClick={() => moveQuestion.mutate({ sectionId: section.id, id: q.id, direction: "up" }, { onError: fail })}>
                      <ArrowUp className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Move question down" disabled={qi === section.questions.length - 1} onClick={() => moveQuestion.mutate({ sectionId: section.id, id: q.id, direction: "down" }, { onError: fail })}>
                      <ArrowDown className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Edit question" onClick={() => setQuestionTarget({ sectionId: section.id, question: q })}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Delete question" onClick={() => deleteQuestion.mutate({ sectionId: section.id, id: q.id }, { onError: fail })}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}

      <Button variant="secondary" size="sm" onClick={() => setSectionForm({ title: "", description: "" })}>
        <Plus className="h-4 w-4" /> Add section
      </Button>

      <FormDialog
        open={sectionForm !== null}
        onOpenChange={(o) => !o && setSectionForm(null)}
        title={sectionForm?.id ? "Edit section" : "Add section"}
        saving={addSection.isPending || updateSection.isPending}
        submitDisabled={!sectionForm?.title.trim()}
        onSubmit={saveSection}
      >
        {sectionForm && (
          <>
            <DrawerField label="Title" required>
              <Input value={sectionForm.title} onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })} autoFocus />
            </DrawerField>
            <DrawerField label="Description" hint="Shown above the section's questions.">
              <Textarea rows={2} value={sectionForm.description} onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })} />
            </DrawerField>
          </>
        )}
      </FormDialog>

      <QuestionDialog survey={survey} target={questionTarget} onClose={() => setQuestionTarget(null)} />

      <ConfirmDialog
        open={sectionToDelete !== null}
        onOpenChange={(o) => !o && setSectionToDelete(null)}
        variant="danger"
        title={`Delete “${sectionToDelete?.title}”?`}
        description={`This also removes its ${sectionToDelete?.questions.length ?? 0} question(s) from this survey. The question bank is not affected.`}
        confirmLabel="Delete"
        loading={deleteSection.isPending}
        onConfirm={() =>
          sectionToDelete &&
          deleteSection.mutate(sectionToDelete.id, {
            onSuccess: () => setSectionToDelete(null),
            onError: (e) => {
              toast.error((e as Error).message);
              setSectionToDelete(null);
            },
          })
        }
      />
    </div>
  );
}
