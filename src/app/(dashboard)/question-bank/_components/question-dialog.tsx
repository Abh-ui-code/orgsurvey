"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/shared/form-dialog";
import {
  QuestionFormFields,
  fieldsFromDraft,
  isDraftComplete,
  type QuestionDraft,
} from "@/components/shared/question-form";
import { DrawerField } from "@/components/ui/drawer-form";
import { Select } from "@/components/ui/select";
import { useBankCategories } from "@/hooks/use-bank-categories";
import { useSaveBankQuestion } from "../_hooks/use-question-bank";

export interface BankDraft extends QuestionDraft {
  id?: string;
  category_id: string;
}

/** Add a reusable question, or edit one. `draft` is null when closed. */
export function QuestionDialog({ draft, onClose }: { draft: BankDraft | null; onClose: () => void }) {
  const categories = useBankCategories();
  const save = useSaveBankQuestion();
  const [value, setValue] = useState<BankDraft | null>(draft);
  const [seen, setSeen] = useState(draft);
  if (draft !== seen) {
    setSeen(draft);
    setValue(draft);
  }

  return (
    <FormDialog
      open={draft !== null}
      onOpenChange={(o) => !o && onClose()}
      title={value?.id ? "Edit question" : "Add question"}
      side="right"
      saving={save.isPending}
      submitDisabled={!value || !value.category_id || !isDraftComplete(value)}
      onSubmit={() =>
        value &&
        save.mutate(
          { id: value.id, category_id: value.category_id, ...fieldsFromDraft(value) },
          {
            onSuccess: () => {
              toast.success("Question saved");
              onClose();
            },
            onError: (e) => toast.error((e as Error).message),
          },
        )
      }
    >
      {value && (
        <>
          <DrawerField label="Category" required>
            <Select value={value.category_id} onChange={(e) => setValue({ ...value, category_id: e.target.value })}>
              <option value="">Choose a category</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </DrawerField>
          <QuestionFormFields value={value} onChange={(next) => setValue({ ...value, ...next })} />
        </>
      )}
    </FormDialog>
  );
}
