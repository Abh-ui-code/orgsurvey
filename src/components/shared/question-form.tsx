"use client";

import { DrawerField } from "@/components/ui/drawer-form";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X } from "lucide-react";
import { QUESTION_TYPES, type QuestionFields, type QuestionPart, type QuestionType } from "@/types/question";

/** Form state for a question. Options are edited as one-per-line text. */
export interface QuestionDraft {
  text: string;
  type: QuestionType;
  unit: string;
  parts: QuestionPart[];
  optionsText: string;
  hint: string;
  required: boolean;
}

export const EMPTY_QUESTION: QuestionDraft = { text: "", type: "text", unit: "", parts: [], optionsText: "", hint: "", required: true };
const NEW_PART: QuestionPart = { label: "", kind: "number", unit: "" };

export function draftFromQuestion(q: QuestionFields): QuestionDraft {
  return { text: q.text, type: q.type, unit: q.unit ?? "", parts: q.parts ?? [], optionsText: q.options.join("\n"), hint: q.hint, required: q.required };
}

export function fieldsFromDraft(d: QuestionDraft): QuestionFields {
  return {
    text: d.text,
    type: d.type,
    unit: d.type === "number" || d.type === "short_text" ? d.unit.trim() : "",
    parts: d.type === "table" ? d.parts.map((p) => ({ ...p, label: p.label.trim(), unit: p.kind === "number" ? p.unit.trim() : "" })) : [],
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
  if (d.type === "table" && (d.parts.length === 0 || d.parts.some((p) => !p.label.trim()))) return false;
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
      {(value.type === "number" || value.type === "short_text") && (
        <DrawerField label={value.type === "number" ? "Unit" : "Label beside the box"} hint={value.type === "number" ? "Shown beside the box, e.g. hectares, %, tonnes CO₂-e. Leave empty for a plain count." : "Optional, shown beside the box, e.g. highest-paid : median."}>
          <Input value={value.unit} maxLength={40} placeholder="e.g. hectares" onChange={(e) => onChange({ ...value, unit: e.target.value })} />
        </DrawerField>
      )}
      {value.type === "table" && <PartsEditor parts={value.parts} onChange={(parts) => onChange({ ...value, parts })} />}
      {hasChoices(value.type) && (
        <DrawerField label="Options" required hint="One option per line, at least two.">
          <Textarea rows={4} value={value.optionsText} onChange={(e) => onChange({ ...value, optionsText: e.target.value })} />
        </DrawerField>
      )}
      <DrawerField label="Hint" hint="Shown under the question to help the respondent.">
        <Input value={value.hint} onChange={(e) => onChange({ ...value, hint: e.target.value })} />
      </DrawerField>
      <label className="flex items-center gap-2 text-sm text-ink">
        <Switch checked={value.required} onCheckedChange={(c) => onChange({ ...value, required: c })} />
        Required
      </label>
    </div>
  );
}

/** The rows of a table question: what each is called, whether it takes a number or text, and a number's unit. */
function PartsEditor({ parts, onChange }: { parts: QuestionPart[]; onChange: (next: QuestionPart[]) => void }) {
  const set = (i: number, patch: Partial<QuestionPart>) => onChange(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <DrawerField label="Rows" required hint="One row per thing to answer. Numbers get a number-only box with the unit beside it, dates a date picker, text rows a text box.">
      <div className="space-y-2">
        {parts.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-line bg-paper-raised p-2 sm:grid-cols-[minmax(0,2fr)_8rem_minmax(0,1fr)_auto]">
            <Input aria-label={`Row ${i + 1} label`} placeholder="Row label, e.g. Total area" value={p.label} maxLength={200} onChange={(e) => set(i, { label: e.target.value })} />
            <Select aria-label={`Row ${i + 1} kind`} value={p.kind} onChange={(e) => set(i, { kind: e.target.value as QuestionPart["kind"] })} className="col-start-1 sm:col-start-auto">
              <option value="number">Number</option>
              <option value="text">Text</option>
              <option value="date">Date</option>
            </Select>
            {p.kind === "number" ? (
              <Input aria-label={`Row ${i + 1} unit`} placeholder="Unit" value={p.unit} maxLength={40} onChange={(e) => set(i, { unit: e.target.value })} />
            ) : (
              <span className="hidden sm:block" />
            )}
            <button type="button" aria-label={`Remove row ${i + 1}`} onClick={() => onChange(parts.filter((_, j) => j !== i))} className="row-start-1 col-start-2 self-center rounded-md p-1.5 text-ink-faint hover:bg-paper-sunken hover:text-rust sm:row-start-auto sm:col-start-auto">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...parts, { ...NEW_PART }])} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-brand hover:bg-brand-soft">
          <Plus className="h-3.5 w-3.5" /> Add row
        </button>
      </div>
    </DrawerField>
  );
}
