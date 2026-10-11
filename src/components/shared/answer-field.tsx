"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SurveyQuestion } from "@/types/question";
import type { AnswerValue } from "@/types/survey";
import { cn } from "@/lib/utils";

/** True when a value counts as an answer (not blank, not an empty selection). */
export function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === "") return false;
  return !(Array.isArray(value) && value.length === 0);
}

export function formatAnswer(value: AnswerValue | undefined): string {
  if (value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

function ChoiceButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1.5 text-sm transition-colors",
        active ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-paper-raised text-ink-muted hover:bg-paper-sunken",
      )}
    >
      {children}
    </button>
  );
}

/** Input for one question, by type. Controlled: the parent owns the answers map. */
export function AnswerField({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  value: AnswerValue | undefined;
  onChange: (next: AnswerValue) => void;
}) {
  switch (question.type) {
    case "text":
      return (
        <Textarea
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer"
        />
      );
    case "number":
      return (
        <Input
          type="number"
          className="max-w-48"
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
      );
    case "date":
      return (
        <Input type="date" className="max-w-48" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
      );
    case "rating":
      return (
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <ChoiceButton key={n} active={value === n} onClick={() => onChange(n)}>
              {n}
            </ChoiceButton>
          ))}
        </div>
      );
    case "yes_no":
      return (
        <div className="flex gap-2">
          {["Yes", "No"].map((o) => (
            <ChoiceButton key={o} active={value === o} onClick={() => onChange(o)}>
              {o}
            </ChoiceButton>
          ))}
        </div>
      );
    case "single_choice":
      return (
        <div className="flex flex-wrap gap-2">
          {question.options.map((o) => (
            <ChoiceButton key={o} active={value === o} onClick={() => onChange(o)}>
              {o}
            </ChoiceButton>
          ))}
        </div>
      );
    case "multi_choice": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {question.options.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm text-ink">
              <Checkbox
                checked={selected.includes(o)}
                onCheckedChange={(c) => onChange(c === true ? [...selected, o] : selected.filter((x) => x !== o))}
              />
              {o}
            </label>
          ))}
        </div>
      );
    }
  }
}
