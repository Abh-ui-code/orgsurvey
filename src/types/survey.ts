import type { Person, Ref } from "@/types/common";
import type { SurveyQuestion } from "@/types/question";

/** The workflow runs per question (see QuestionStatus). A survey is a draft, then in progress
 * until every question is approved, then approved; `closed` is an administrator withdrawing it. */
export type SurveyStatus = "draft" | "in_progress" | "approved" | "closed";

export const SURVEY_STATUSES: SurveyStatus[] = ["draft", "in_progress", "approved", "closed"];

/** Published and still moving. */
export const LIVE_STATUSES: SurveyStatus[] = ["in_progress"];

/** Where one question is: with its respondent, in review, awaiting approval, sent back, or approved. */
export type QuestionStatus = "awaiting_response" | "awaiting_review" | "awaiting_approval" | "returned" | "approved";

export const QUESTION_STATUSES: QuestionStatus[] = ["awaiting_response", "awaiting_review", "awaiting_approval", "returned", "approved"];

/** Questions at each stage, plus the total. */
export type StageCounts = Record<QuestionStatus, number> & { total: number };

/** One respondent and the stage of their questions. */
export interface RespondentProgress {
  person: Person;
  stats: StageCounts;
  question_ids: string[];
}

/** The three people a survey is assigned to. */
export type WorkflowRole = "responder" | "reviewer" | "approver";

/** How a role is written for people: the API's `responder` is shown as "respondent". */
export const roleName = (role: string): string => (role === "responder" ? "respondent" : role);

export const WORKFLOW_ROLES: { value: WorkflowRole; label: string; description: string }[] = [
  { value: "responder", label: "Respondent", description: "Answers the questions assigned to them" },
  { value: "reviewer", label: "Reviewer", description: "Checks submitted questions" },
  { value: "approver", label: "Approver", description: "Gives final approval per question" },
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
  /** How many questions it covers. */
  count: number;
}

/** Who is holding a survey up right now, and in which role. */
export interface WaitingOn {
  role: WorkflowRole;
  person: Person;
  /** How many questions are with them. */
  count: number;
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
  /** The default respondent: takes any question with no one assigned when the survey is published. */
  responder: Person | null;
  reviewer: Person | null;
  approver: Person | null;
  due_date: string | null;
  /** In progress and past its due date. */
  is_overdue: boolean;
  question_count: number;
  /** How many times it was sent back, and how many times it was submitted. */
  return_count: number;
  submission_count: number;
  my_task: MyTask | null;
  /** Everyone it is with now, each with their number of questions; empty for drafts, approved and closed surveys. */
  waiting_on: WaitingOn[];
  /** Questions at each stage, among those the signed-in person can see. */
  question_stats: StageCounts;
  /** How many questions the signed-in person can see. */
  my_question_count: number;
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
  /** Set when this section is a whole GRI standard: its questions are fixed and it goes to one respondent. */
  gri: { id: string; code: string; title: string; pdf: string } | null;
  questions: SurveyQuestion[];
}

export type HistoryAction = "created" | "published" | "submitted" | "reviewed" | "approved" | "returned" | "closed";

/** Who a return was sent to. */
export type ReturnAudience = "responder" | "reviewer" | "both";

/** A note pinned to one question by the reviewer or approver. */
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
  /** Set on a return: respondent, reviewer or both. Empty otherwise. */
  audience: ReturnAudience | "";
  /** The questions this step was about; empty for steps about the whole survey. */
  question_ids: string[];
  /** For a submission: the answers as sent. Empty for other steps (and for submissions made before this was recorded). */
  snapshot: Record<string, AnswerValue>;
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
  /** The respondent's unsent work. Empty for everyone else. */
  draft_answers: Record<string, AnswerValue>;
  readiness: Readiness[];
  /** Each respondent with their questions' progress. Empty for a respondent, who sees only their own. */
  respondents: RespondentProgress[];
  history: HistoryEntry[];
  created_by: Person | null;
}
