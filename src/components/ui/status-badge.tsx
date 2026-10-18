import { Badge } from "@/components/ui/badge";
import type { QuestionStatus, SurveyStatus } from "@/types/survey";

type Tone = "neutral" | "brand" | "amber" | "rust" | "moss";

/** One definitive rendering per workflow state, so a status never gets
 * restyled per screen. */
const SURVEY_STATUS: Record<SurveyStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  in_progress: { label: "In progress", tone: "brand" },
  approved: { label: "Approved", tone: "moss" },
  closed: { label: "Closed", tone: "neutral" },
};

export const QUESTION_STATUS: Record<QuestionStatus, { label: string; short: string; tone: Tone; bar: string }> = {
  approved: { label: "Approved", short: "Approved", tone: "moss", bar: "bg-moss" },
  awaiting_approval: { label: "Awaiting approval", short: "With approver", tone: "amber", bar: "bg-amber" },
  awaiting_review: { label: "Awaiting review", short: "In review", tone: "brand", bar: "bg-brand" },
  returned: { label: "Returned", short: "Returned", tone: "rust", bar: "bg-rust" },
  awaiting_response: { label: "Awaiting response", short: "Not submitted", tone: "neutral", bar: "bg-line-strong" },
};

export function SurveyStatusBadge({ status }: { status: SurveyStatus }) {
  const entry = SURVEY_STATUS[status];
  return (
    <Badge tone={entry.tone} dot>
      {entry.label}
    </Badge>
  );
}

export function QuestionStatusBadge({ status }: { status: QuestionStatus }) {
  const entry = QUESTION_STATUS[status];
  return (
    <Badge tone={entry.tone} dot>
      {entry.label}
    </Badge>
  );
}

export function statusLabel(status: SurveyStatus): string {
  return SURVEY_STATUS[status].label;
}
