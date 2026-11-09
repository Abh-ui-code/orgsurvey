"use client";

import { questionNumber } from "@/lib/gri";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/shared/avatar";
import { PersonSelect } from "@/components/shared/person-select";
import { FormDialog } from "@/components/shared/form-dialog";
import { IconButton } from "@/components/shared/icon-button";
import { FileText } from "lucide-react";
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
  useReorderQuestions,
  useReorderSections,
  useAssignSection,
  useUpdateSection,
} from "../../_hooks/use-survey-builder";
import { QuestionDialog, type QuestionTarget } from "./question-dialog";

/** The one person a whole section is assigned to, or "" when it isn't (or isn't all one person). */
const commonResponder = (section: SurveySection) => {
  const first = section.questions[0]?.responder?.id ?? "";
  return first && section.questions.every((q) => q.responder?.id === first) ? first : "";
};

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
  const reorderSections = useReorderSections(survey.id);
  const reorderQuestions = useReorderQuestions(survey.id);
  // What is being dragged, and the row it is currently over.
  const [drag, setDrag] = useState<{ kind: "section" | "question"; id: string; sectionId?: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const deleteQuestion = useDeleteQuestion(survey.id);
  const assign = useAssignQuestions(survey.id);
  const assignSection = useAssignSection(survey.id);

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

  /** Drop `drag` where `targetId` is: the dragged item takes the target's place. */
  function drop(kind: "section" | "question", targetId: string, sectionId?: string) {
    const d = drag;
    setDrag(null);
    setOver(null);
    if (!d || d.kind !== kind || d.id === targetId || d.sectionId !== sectionId) return;
    const ids = (kind === "section" ? survey.sections : survey.sections.find((x) => x.id === sectionId)!.questions).map((x) => x.id);
    ids.splice(ids.indexOf(d.id), 1);
    ids.splice(ids.indexOf(targetId), 0, d.id);
    if (kind === "section") reorderSections.mutate(ids, { onError: fail });
    else reorderQuestions.mutate({ sectionId: sectionId!, ids }, { onError: fail });
  }
  const dragProps = (kind: "section" | "question", id: string, sectionId?: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (drag?.kind === kind && drag.sectionId === sectionId) {
        e.preventDefault();
        setOver(id);
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      drop(kind, id, sectionId);
    },
  });
  const grip = (kind: "section" | "question", id: string, label: string, sectionId?: string) => (
    <span
      draggable
      aria-label={label}
      title="Drag to reorder"
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        setDrag({ kind, id, sectionId });
      }}
      onDragEnd={() => {
        setDrag(null);
        setOver(null);
      }}
      className="shrink-0 cursor-grab touch-none text-ink-faint hover:text-ink active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4" />
    </span>
  );

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
        <Card
          key={section.id}
          {...dragProps("section", section.id)}
          className={drag?.kind === "section" && drag.id === section.id ? "opacity-50" : over === section.id && drag?.kind === "section" ? "ring-2 ring-brand/50" : ""}
        >
          <CardHeader className="items-center py-3">
            <div className="flex min-w-0 items-center gap-2">
              {section.questions.length > 0 && (
                <Checkbox
                  aria-label={`Select every question in ${section.title}`}
                  checked={section.questions.every((q) => picked.has(q.id))}
                  onCheckedChange={(v) => toggle(section.questions.map((q) => q.id), v === true)}
                />
              )}
              {grip("section", section.id, `Drag section ${section.title}`)}
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  {section.title}
                  {section.gri && <Badge tone="brand">{section.gri.framework.toUpperCase()}</Badge>}
                </CardTitle>
                {section.description && <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{section.description}</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              {section.gri ? (
                <>
                  <a href={section.gri.pdf} target="_blank" rel="noreferrer" className="mr-1 inline-flex items-center gap-1 text-xs text-brand-strong hover:underline">
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </a>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/surveys/${survey.id}/add-question?section=${section.id}`}>
                      <Plus className="h-4 w-4" /> Question
                    </Link>
                  </Button>
                  <div className="mr-1 w-52">
                    <PersonSelect
                      value={commonResponder(section)}
                      placeholder="Assign whole section…"
                      disabledIds={handlers}
                      onChange={(id) =>
                        assignSection.mutate(
                          { sectionId: section.id, responder_id: id || null },
                          { onSuccess: () => toast.success(id ? "Section assigned" : "Section unassigned"), onError: fail },
                        )
                      }
                    />
                  </div>
                </>
              ) : (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/surveys/${survey.id}/add-question?section=${section.id}`}>
                    <Plus className="h-4 w-4" /> Question
                  </Link>
                </Button>
              )}
              <IconButton label="Move section up" disabled={si === 0} onClick={() => moveSection.mutate({ id: section.id, direction: "up" }, { onError: fail })}>
                <ArrowUp className="h-4 w-4" />
              </IconButton>
              <IconButton label="Move section down" disabled={si === lastSection} onClick={() => moveSection.mutate({ id: section.id, direction: "down" }, { onError: fail })}>
                <ArrowDown className="h-4 w-4" />
              </IconButton>
              {!section.gri && (
                <IconButton label="Edit section" onClick={() => setSectionForm({ id: section.id, title: section.title, description: section.description })}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
              )}
              <IconButton label="Delete section" disabled={survey.sections.length <= 1} onClick={() => setSectionToDelete(section)}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          </CardHeader>
          {section.gri && (
            <p className="flex items-center gap-1.5 border-b border-line px-5 py-2 text-xs">
              <span className="text-ink-muted">Respondent for the whole section</span>
              {section.questions[0]?.responder && commonResponder(section) ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-sunken py-0.5 pl-0.5 pr-2 font-medium text-ink">
                  <Avatar name={section.questions[0].responder.full_name} className="h-5 w-5 text-2xs" /> {section.questions[0].responder.full_name}
                </span>
              ) : (
                <span className="font-medium text-rust">Not assigned</span>
              )}
            </p>
          )}
          {section.questions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-faint">No questions in this section yet.</p>
          ) : (
            <ul>
              {section.questions.map((q, qi) => (
                <li
                  key={q.id}
                  {...dragProps("question", q.id, section.id)}
                  className={`flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-b-0 ${picked.has(q.id) ? "bg-brand-soft/40" : ""} ${
                    drag?.kind === "question" && drag.id === q.id ? "opacity-40" : ""
                  } ${over === q.id && drag?.kind === "question" && drag.id !== q.id ? "border-t-2 border-t-brand" : ""}`}
                >
                  {grip("question", q.id, `Drag question ${qi + 1}`, section.id)}
                  {!(section.gri && q.gri_ref) && <Checkbox aria-label={`Select question ${qi + 1}`} checked={picked.has(q.id)} onCheckedChange={(v) => toggle([q.id], v === true)} />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      {q.text} {q.required && <span className="text-rust">*</span>}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                      <span className="font-mono-data">{section.gri && q.gri_title ? questionNumber(q.gri_ref, q.gri_item) : `Q${qi + 1}`}</span>
                      <span>·</span>
                      <span>{questionTypeLabel(q.type)}</span>
                      {q.bank_question_id && !q.gri_ref && <Badge tone="brand">From bank</Badge>}
                      {q.options.length > 0 && <span className="truncate">· {q.options.join(", ")}</span>}
                    </p>
                    {q.hint && <p className="mt-1 text-xs italic text-ink-muted">{q.hint}</p>}
                    {!(section.gri && q.gri_ref) && <p className="mt-1.5 flex items-center gap-1.5 text-xs">
                      <span className="text-ink-muted">Respondent</span>
                      {q.responder ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-sunken py-0.5 pl-0.5 pr-2 font-medium text-ink">
                          <Avatar name={q.responder.full_name} className="h-5 w-5 text-2xs" /> {q.responder.full_name}
                        </span>
                      ) : (
                        <span className="font-medium text-rust">Not assigned</span>
                      )}
                    </p>}
                  </div>
                  {!(section.gri && q.gri_ref) && <div className="flex shrink-0 items-center gap-1">
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
                  </div>}
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
