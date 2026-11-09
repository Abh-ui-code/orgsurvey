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
/** A file a respondent attached to a question as evidence. */
export interface Attachment {
  id: string;
  name: string;
  size: number;
  /** False while the respondent is still working on it: only they can see it. */
  submitted: boolean;
  /** "response": the respondent's evidence. "review": attached by a reviewer or approver with a note. */
  kind: "response" | "review";
}

export interface SurveyQuestion extends QuestionFields {
  id: string;
  order: number;
  bank_question_id: string | null;
  /** The disclosure number (e.g. "401-1", or the SASB metric code) when it comes from a standard, else "". */
  gri_ref: string;
  /** The disclosure's title in the PDF (e.g. "Direct (Scope 1) GHG emissions") and the requirement letter ("a", "b" ...). Empty for SASB. */
  gri_title: string;
  gri_item: string;
  /** Its place in the whole survey (Q1, Q2 ...), the same for everyone who can see it. */
  number: number;
  /** The one person who answers it. */
  responder: Person | null;
  status: QuestionStatus;
  /** Furthest stage reached: 0 not submitted, 1 submitted, 2 passed review. */
  progress: number;
  /** Files attached to this question (only the respondent sees unsent ones). */
  attachments: Attachment[];
}

export type StandardFramework = "gri" | "sasb" | "tcfd" | "rspo" | "wef";

export type GriSeries =
  | "universal"
  | "sector"
  | "economic"
  | "environmental"
  | "social"
  | "tcfd"
  | "rspo"
  | "wef"
  | "consumer_goods"
  | "extractives"
  | "financials"
  | "food_beverage"
  | "health_care"
  | "infrastructure"
  | "renewable"
  | "resource_transf"
  | "services"
  | "tech_comms"
  | "transportation";

export const GRI_SERIES: { value: GriSeries; label: string; blurb: string }[] = [
  { value: "universal", label: "Universal Standards", blurb: "Apply to every organization" },
  { value: "sector", label: "Sector Standards", blurb: "Industry-specific disclosures" },
  { value: "economic", label: "Economic topics", blurb: "GRI 200 series" },
  { value: "environmental", label: "Environmental topics", blurb: "GRI 100 and 300 series" },
  { value: "social", label: "Social topics", blurb: "GRI 400 series" },
];

/** The TCFD recommendations: one standard per pillar. */
export const TCFD_PILLARS: { value: GriSeries; label: string; blurb: string }[] = [
  { value: "tcfd", label: "Recommendations", blurb: "Governance, Strategy, Risk Management, Metrics and Targets" },
];

/** The RSPO Principles & Criteria: one standard per principle. */
export const RSPO_PRINCIPLES: { value: GriSeries; label: string; blurb: string }[] = [
  { value: "rspo", label: "Principles & Criteria", blurb: "Principles 1 to 7, with their criteria and indicators" },
];

/** The WEF Stakeholder Capitalism Metrics: one standard per pillar. */
export const WEF_PILLARS: { value: GriSeries; label: string; blurb: string }[] = [
  { value: "wef", label: "Stakeholder Capitalism Metrics", blurb: "Governance, Planet, People and Prosperity: core and expanded metrics" },
];

/** The SASB sectors, in the order SASB lists them. Each groups its industry standards. */
export const SASB_SECTORS: { value: GriSeries; label: string; blurb: string }[] = [
  { value: "consumer_goods", label: "Consumer Goods", blurb: "CG" },
  { value: "extractives", label: "Extractives & Minerals Processing", blurb: "EM" },
  { value: "financials", label: "Financials", blurb: "FN" },
  { value: "food_beverage", label: "Food & Beverage", blurb: "FB" },
  { value: "health_care", label: "Health Care", blurb: "HC" },
  { value: "infrastructure", label: "Infrastructure", blurb: "IF" },
  { value: "renewable", label: "Renewable Resources & Alternative Energy", blurb: "RR" },
  { value: "resource_transf", label: "Resource Transformation", blurb: "RT" },
  { value: "services", label: "Services", blurb: "SV" },
  { value: "tech_comms", label: "Technology & Communications", blurb: "TC" },
  { value: "transportation", label: "Transportation", blurb: "TR" },
];

/** What each framework is called, how its standards are grouped, and where the question bank lists them. */
export const FRAMEWORKS: Record<StandardFramework, { label: string; short: string; groups: typeof GRI_SERIES; param: string }> = {
  gri: { label: "GRI standards", short: "GRI", groups: GRI_SERIES, param: "gri" },
  sasb: { label: "SASB standards", short: "SASB", groups: SASB_SECTORS, param: "sasb" },
  tcfd: { label: "TCFD recommendations", short: "TCFD", groups: TCFD_PILLARS, param: "tcfd" },
  rspo: { label: "RSPO standards", short: "RSPO", groups: RSPO_PRINCIPLES, param: "rspo" },
  wef: { label: "WEF metrics", short: "WEF", groups: WEF_PILLARS, param: "wef" },
};

/** One reporting standard (a GRI Standard, a SASB industry standard or a TCFD pillar an RSPO principle or a WEF pillar): a ready-made section with its own questions and PDF. */
export interface GriStandard {
  id: string;
  framework: StandardFramework;
  slug: string;
  code: string;
  number: number;
  title: string;
  edition: string;
  series: GriSeries;
  summary: string;
  /** Where the PDF is served from, e.g. /gri/gri-401-employment.pdf or /sasb/sasb-airlines.pdf. */
  pdf: string;
  question_count: number;
}

export interface GriQuestion {
  id: string;
  /** The disclosure or topic as numbered in the PDF: "305-1", "Topic 11.1", "Requirement 2". */
  ref: string;
  title: string;
  /** The requirement letter under it ("a", "b" ...), or "". */
  item: string;
  text: string;
  type: QuestionType;
  hint: string;
  required: boolean;
}

export interface GriStandardDetail extends GriStandard {
  questions: GriQuestion[];
}
