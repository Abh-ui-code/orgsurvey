import type { Person } from "@/types/common";
import type { QuestionStatus } from "@/types/survey";

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
  /** The disclosure number (e.g. "401-1") when it comes from a GRI standard, else "". */
  gri_ref: string;
  /** Its place in the whole survey (Q1, Q2 ...), the same for everyone who can see it. */
  number: number;
  /** The one person who answers it. */
  responder: Person | null;
  status: QuestionStatus;
  /** Furthest stage reached: 0 not submitted, 1 submitted, 2 passed review. */
  progress: number;
}

export type GriSeries = "universal" | "sector" | "economic" | "environmental" | "social";

export const GRI_SERIES: { value: GriSeries; label: string; blurb: string }[] = [
  { value: "universal", label: "Universal Standards", blurb: "Apply to every organization" },
  { value: "sector", label: "Sector Standards", blurb: "Industry-specific disclosures" },
  { value: "economic", label: "Economic topics", blurb: "GRI 200 series" },
  { value: "environmental", label: "Environmental topics", blurb: "GRI 100 and 300 series" },
  { value: "social", label: "Social topics", blurb: "GRI 400 series" },
];

/** One GRI Standard: a ready-made section with its own questions and PDF. */
export interface GriStandard {
  id: string;
  slug: string;
  code: string;
  number: number;
  title: string;
  edition: string;
  series: GriSeries;
  summary: string;
  /** Where the PDF is served from, e.g. /gri/gri-401-employment.pdf. */
  pdf: string;
  question_count: number;
}

export interface GriQuestion {
  id: string;
  ref: string;
  text: string;
  type: QuestionType;
  hint: string;
  required: boolean;
}

export interface GriStandardDetail extends GriStandard {
  questions: GriQuestion[];
}
