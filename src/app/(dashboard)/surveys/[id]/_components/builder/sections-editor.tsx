"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/shared/form-dialog";
import { IconButton } from "@/components/shared/icon-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DrawerField } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { questionTypeLabel } from "@/types/question";
import type { SurveyDetail, SurveySection } from "@/types/survey";
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

  const [sectionForm, setSectionForm] = useState<SectionDraft | null>(null);
  const [questionTarget, setQuestionTarget] = useState<QuestionTarget | null>(null);
  const [sectionToDelete, setSectionToDelete] = useState<SurveySection | null>(null);

  const fail = (e: Error) => toast.error(e.message);
  const lastSection = survey.sections.length - 1;

  function saveSection() {
    if (!sectionForm) return;
    const done = { onSuccess: () => setSectionForm(null), onError: fail };
    const body = { title: sectionForm.title, description: sectionForm.description };
    if (sectionForm.id) updateSection.mutate({ id: sectionForm.id, ...body }, done);
    else addSection.mutate(body, done);
  }

  return (
    <div className="space-y-4">
      {survey.sections.map((section, si) => (
        <Card key={section.id}>
          <CardHeader className="items-start">
            <div className="min-w-0">
              <CardTitle>
                <span className="mr-2 font-mono-data text-ink-faint">{si + 1}.</span>
                {section.title}
              </CardTitle>
              {section.description && <p className="mt-1 text-sm text-ink-muted">{section.description}</p>}
            </div>
            <div className="flex shrink-0 items-center">
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
          <CardContent className="space-y-2">
            {section.questions.length === 0 && <p className="py-2 text-sm text-ink-muted">No questions in this section yet.</p>}
            {section.questions.map((q, qi) => (
              <div key={q.id} className="flex items-start gap-3 rounded-md border border-line p-3">
                <span className="mt-0.5 w-5 shrink-0 font-mono-data text-xs text-ink-faint">{qi + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">
                    {q.text} {q.required && <span className="text-rust">*</span>}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
                    {questionTypeLabel(q.type)}
                    {q.bank_question_id && <Badge tone="brand">From bank</Badge>}
                    {q.options.length > 0 && <span>· {q.options.join(", ")}</span>}
                  </p>
                  {q.hint && <p className="mt-1 text-xs italic text-ink-muted">{q.hint}</p>}
                </div>
                <div className="flex shrink-0 items-center">
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
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setQuestionTarget({ sectionId: section.id })}>
              <Plus className="h-3.5 w-3.5" /> Add question
            </Button>
          </CardContent>
        </Card>
      ))}

      <Button variant="secondary" onClick={() => setSectionForm({ title: "", description: "" })}>
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
