"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/shared/form-dialog";
import { QuestionFormFields, draftFromQuestion, fieldsFromDraft, isDraftComplete, type QuestionDraft } from "@/components/shared/question-form";
import type { SurveyQuestion } from "@/types/question";
import type { SurveyDetail } from "@/types/survey";
import { useUpdateQuestion } from "../../_hooks/use-survey-builder";

export interface QuestionTarget {
  sectionId: string;
  question: SurveyQuestion;
}

/** Edit one question of a draft survey. Adding happens on its own page. */
export function QuestionDialog({ survey, target, onClose }: { survey: SurveyDetail; target: QuestionTarget | null; onClose: () => void }) {
  const update = useUpdateQuestion(survey.id);
  const [draft, setDraft] = useState<QuestionDraft | null>(null);
  const [seen, setSeen] = useState<QuestionTarget | null>(null);
  if (target !== seen) {
    setSeen(target);
    setDraft(target ? draftFromQuestion(target.question) : null);
  }

  function save() {
    if (!target || !draft) return;
    update.mutate(
      { sectionId: target.sectionId, id: target.question.id, ...fieldsFromDraft(draft) },
      {
        onSuccess: () => {
          toast.success("Question updated");
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  return (
    <FormDialog
      open={target !== null}
      onOpenChange={(o) => !o && onClose()}
      title="Edit question"
      side="right"
      size="lg"
      saving={update.isPending}
      submitDisabled={!draft || !isDraftComplete(draft)}
      submitLabel="Save question"
      onSubmit={save}
    >
      {draft && <QuestionFormFields value={draft} onChange={setDraft} />}
    </FormDialog>
  );
}
