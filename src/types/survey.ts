import type { Person, Ref } from "@/types/common";
import type { SurveyQuestion } from "@/types/question";

/** draft -> (publish) -> awaiting_response -> awaiting_review -> awaiting_approval -> approved,
 * with `returned` as the send-back loop and `closed` as an administrator withdrawing it. */
export type SurveyStatus =
  | "draft"
  | "awaiting_response"
  | "awaiting_review"
  | "awaiting_approval"
  | "returned"
  | "approved"
  | "closed";

export const SURVEY_STATUSES: SurveyStatus[] = [
  "draft",
  "awaiting_response",
  "awaiting_review",
  "awaiting_approval",
  "returned",
  "approved",
  "closed",
];

/** Published and still moving. */
export const LIVE_STATUSES: SurveyStatus[] = ["awaiting_response", "awaiting_review", "awaiting_approval", "returned"];

/** The three people a survey is assigned to. */
export type WorkflowRole = "responder" | "reviewer" | "approver";

export const WORKFLOW_ROLES: { value: WorkflowRole; label: string; description: string }[] = [
  { value: "responder", label: "Responder", description: "Fills in the survey" },
  { value: "reviewer", label: "Reviewer", description: "Checks the response" },
  { value: "approver", label: "Approver", description: "Gives final approval" },
];

export type CategoryColor = "brand" | "amber" | "moss" | "rust" | "slate";
export const CATEGORY_COLORS: CategoryColor[] = ["brand", "moss", "amber", "rust", "slate"];

/** The topic a survey belongs to, managed in Settings. */
export interface SurveyCategory {
  id: string;
  code: string;
  label: string;
  description: string;
  color: CategoryColor;
  display_order: number;
  is_active: boolean;
  survey_count: number;
}

export interface CategoryRef {
  id: string;
  label: string;
  color: CategoryColor;
}

/** What the signed-in person has to do on a survey right now. */
export interface MyTask {
  role: WorkflowRole;
  action: string;
}

/** Who is holding a survey up right now, and in which role. */
export interface WaitingOn {
  role: WorkflowRole;
  person: Person;
}

/** A survey as it appears in lists. */
export interface Survey {
  id: string;
  title: string;
  description: string;
  status: SurveyStatus;
  category: CategoryRef;
  /** The org block this survey is about. */
  target_unit: Ref;
  responder: Person | null;
  reviewer: Person | null;
  approver: Person | null;
  due_date: string | null;
  /** In progress and past its due date. */
  is_overdue: boolean;
  question_count: number;
  my_task: MyTask | null;
  /** The person it is with now; null for drafts, approved and closed surveys. */
  waiting_on: WaitingOn | null;
  /** When it last changed hands (ISO), for "waiting 6 days". */
  stage_since: string;
  published_at: string | null;
  created_at: string;
}

export type AnswerValue = string | string[] | number;

export interface SurveySection {
  id: string;
  order: number;
  title: string;
  description: string;
  questions: SurveyQuestion[];
}

export type HistoryAction = "created" | "published" | "submitted" | "reviewed" | "approved" | "returned" | "closed";

/** Who a return was sent to. */
export type ReturnAudience = "responder" | "reviewer" | "both";

/** A note pinned to one question by whoever returned the survey. */
export interface QuestionComment {
  id: string;
  question_id: string;
  by: Person | null;
  at: string;
  text: string;
}

export interface HistoryEntry {
  id: string;
  action: HistoryAction;
  by: Person | null;
  at: string;
  comment: string;
  /** Set on a return: responder, reviewer or both. Empty otherwise. */
  audience: ReturnAudience | "";
  question_comments: QuestionComment[];
}

/** What is still missing before a draft can publish. */
export interface Readiness {
  key: string;
  label: string;
  ok: boolean;
}

/** A survey with everything: sections, answers, activity. */
export interface SurveyDetail extends Survey {
  instructions: string;
  sections: SurveySection[];
  answers: Record<string, AnswerValue>;
  /** The responder's unsent work. Empty for everyone else. */
  draft_answers: Record<string, AnswerValue>;
  readiness: Readiness[];
  history: HistoryEntry[];
  created_by: Person | null;
}
