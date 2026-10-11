export type QuestionType = "text" | "single_choice" | "multi_choice" | "rating" | "yes_no" | "number" | "date";

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "text", label: "Free text" },
  { value: "single_choice", label: "Single choice" },
  { value: "multi_choice", label: "Multiple choice" },
  { value: "rating", label: "Rating (1-5)" },
  { value: "yes_no", label: "Yes / No" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
];

export function questionTypeLabel(type: QuestionType): string {
  return QUESTION_TYPES.find((t) => t.value === type)?.label ?? type;
}

/** What a question is made of, in the bank and in a survey alike. */
export interface QuestionFields {
  text: string;
  type: QuestionType;
  options: string[];
  hint: string;
  required: boolean;
}

/** A topic reusable questions are filed under. */
export interface BankCategory {
  id: string;
  label: string;
  description: string;
  display_order: number;
  question_count: number;
}

/** A reusable question in the bank. */
export interface BankQuestion extends QuestionFields {
  id: string;
  category: { id: string; label: string };
}

/** A question inside one survey: a copy, so bank edits never change it. */
export interface SurveyQuestion extends QuestionFields {
  id: string;
  order: number;
  bank_question_id: string | null;
}
