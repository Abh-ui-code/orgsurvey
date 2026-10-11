"use client";

import { DrawerField } from "@/components/ui/drawer-form";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QUESTION_TYPES, type QuestionFields, type QuestionType } from "@/types/question";

/** Form state for a question. Options are edited as one-per-line text. */
export interface QuestionDraft {
  text: string;
  type: QuestionType;
  optionsText: string;
  hint: string;
  required: boolean;
}

export const EMPTY_QUESTION: QuestionDraft = { text: "", type: "text", optionsText: "", hint: "", required: true };

export function draftFromQuestion(q: QuestionFields): QuestionDraft {
  return { text: q.text, type: q.type, optionsText: q.options.join("\n"), hint: q.hint, required: q.required };
}

export function fieldsFromDraft(d: QuestionDraft): QuestionFields {
  return {
    text: d.text,
    type: d.type,
    options: d.optionsText.split("\n"),
    hint: d.hint,
    required: d.required,
  };
}

export function hasChoices(type: QuestionType): boolean {
  return type === "single_choice" || type === "multi_choice";
}

/** True when the draft has what the server will insist on, so Save can be disabled early. */
export function isDraftComplete(d: QuestionDraft): boolean {
  if (!d.text.trim()) return false;
  return !hasChoices(d.type) || d.optionsText.split("\n").filter((o) => o.trim()).length >= 2;
}

/** The fields every question has, in survey builder and question bank alike. */
export function QuestionFormFields({ value, onChange }: { value: QuestionDraft; onChange: (next: QuestionDraft) => void }) {
  return (
    <div className="space-y-4">
      <DrawerField label="Question" required>
        <Textarea rows={2} value={value.text} onChange={(e) => onChange({ ...value, text: e.target.value })} autoFocus />
      </DrawerField>
      <DrawerField label="Answer type">
        <Select value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value as QuestionType })}>
          {QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </DrawerField>
      {hasChoices(value.type) && (
        <DrawerField label="Options" required hint="One option per line, at least two.">
          <Textarea rows={4} value={value.optionsText} onChange={(e) => onChange({ ...value, optionsText: e.target.value })} />
        </DrawerField>
      )}
      <DrawerField label="Hint" hint="Shown under the question to help the responder.">
        <Input value={value.hint} onChange={(e) => onChange({ ...value, hint: e.target.value })} />
      </DrawerField>
      <label className="flex items-center gap-2 text-sm text-ink">
        <Switch checked={value.required} onCheckedChange={(c) => onChange({ ...value, required: c })} />
        Required
      </label>
    </div>
  );
}
