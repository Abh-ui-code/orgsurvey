"use client";

import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/shared/form-dialog";
import {
  EMPTY_QUESTION,
  QuestionFormFields,
  draftFromQuestion,
  fieldsFromDraft,
  isDraftComplete,
  type QuestionDraft,
} from "@/components/shared/question-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBankCategories } from "@/hooks/use-bank-categories";
import { useBankQuestions } from "@/hooks/use-bank-questions";
import { useDebounced } from "@/hooks/use-debounced";
import { questionTypeLabel, type SurveyQuestion } from "@/types/question";
import type { SurveyDetail } from "@/types/survey";
import { useAddQuestion, useUpdateQuestion } from "../../_hooks/use-survey-builder";

export interface QuestionTarget {
  sectionId: string;
  /** Set when editing an existing question; absent when adding. */
  question?: SurveyQuestion;
}

const PICKER_PAGE = 20;

/** Search the question bank and add questions to a section. */
function BankPicker({ survey, sectionId }: { survey: SurveyDetail; sectionId: string }) {
  const categories = useBankCategories();
  const add = useAddQuestion(survey.id);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const bank = useBankQuestions({ search: useDebounced(search), category, page_size: PICKER_PAGE });

  const used = new Set(survey.sections.flatMap((s) => s.questions.map((q) => q.bank_question_id)).filter(Boolean));
  const rows = bank.data?.results ?? [];
  const total = bank.data?.count ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the bank" />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-44">
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
      {bank.isPending ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">No questions match. Write a new one on the other tab.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((q) => (
            <li key={q.id} className="flex items-start gap-3 rounded-md border border-line p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">{q.text}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
                  <Badge>{q.category.label}</Badge>
                  {questionTypeLabel(q.type)}
                </p>
              </div>
              {used.has(q.id) ? (
                <span className="flex shrink-0 items-center gap-1 text-xs text-moss">
                  <Check className="h-3.5 w-3.5" /> Added
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    add.mutate(
                      { sectionId, bank_question_id: q.id },
                      { onSuccess: () => toast.success("Question added"), onError: (e) => toast.error((e as Error).message) },
                    )
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {total > rows.length && <p className="text-xs text-ink-faint">Showing {rows.length} of {total}. Search to narrow the list.</p>}
    </div>
  );
}

/** Add questions to a section (from the bank, or written new), or edit one. */
export function QuestionDialog({ survey, target, onClose }: { survey: SurveyDetail; target: QuestionTarget | null; onClose: () => void }) {
  const add = useAddQuestion(survey.id);
  const update = useUpdateQuestion(survey.id);
  const [draft, setDraft] = useState<QuestionDraft>(EMPTY_QUESTION);
  const [seen, setSeen] = useState<QuestionTarget | null>(null);
  if (target !== seen) {
    setSeen(target);
    setDraft(target?.question ? draftFromQuestion(target.question) : EMPTY_QUESTION);
  }

  const editing = target?.question;
  const section = survey.sections.find((s) => s.id === target?.sectionId);

  function save() {
    if (!target) return;
    const fields = fieldsFromDraft(draft);
    const done = {
      onSuccess: () => {
        toast.success(editing ? "Question updated" : "Question added");
        if (editing) onClose();
        else setDraft(EMPTY_QUESTION); // keep the drawer open to add several
      },
      onError: (e: Error) => toast.error(e.message),
    };
    if (editing) update.mutate({ sectionId: target.sectionId, id: editing.id, ...fields }, done);
    else add.mutate({ sectionId: target.sectionId, ...fields }, done);
  }

  // Editing is a plain form; adding offers the bank as well as a blank form.
  if (editing) {
    return (
      <FormDialog
        open={target !== null}
        onOpenChange={(o) => !o && onClose()}
        title="Edit question"
        side="right"
        size="lg"
        saving={update.isPending}
        submitDisabled={!isDraftComplete(draft)}
        submitLabel="Save question"
        onSubmit={save}
      >
        <QuestionFormFields value={draft} onChange={setDraft} />
      </FormDialog>
    );
  }

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="right" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{`Add to “${section?.title ?? "section"}”`}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="bank" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="px-5">
            <TabsTrigger value="bank">From question bank</TabsTrigger>
            <TabsTrigger value="new">Write new</TabsTrigger>
          </TabsList>
          <TabsContent value="bank" className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {target && <BankPicker survey={survey} sectionId={target.sectionId} />}
          </TabsContent>
          <TabsContent value="new" className="flex min-h-0 flex-1 flex-col">
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                if (isDraftComplete(draft)) save();
              }}
            >
              <DialogBody>
                <QuestionFormFields value={draft} onChange={setDraft} />
              </DialogBody>
              <DialogFooter>
                <Button type="submit" disabled={!isDraftComplete(draft)} loading={add.isPending}>
                  Add question
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
        <DialogFooter className="justify-between">
          <span className="text-xs text-ink-faint">Add as many as you like, then press Done.</span>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
