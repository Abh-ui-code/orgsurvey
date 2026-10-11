import { Badge } from "@/components/ui/badge";
import type { SurveyStatus } from "@/types/survey";

type Tone = "neutral" | "brand" | "amber" | "rust" | "moss";

/** One definitive rendering per workflow state, so a status never gets
 * restyled per screen. The label says who the survey is waiting on. */
const SURVEY_STATUS: Record<SurveyStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  awaiting_response: { label: "Awaiting response", tone: "neutral" },
  awaiting_review: { label: "Awaiting review", tone: "brand" },
  awaiting_approval: { label: "Awaiting approval", tone: "amber" },
  returned: { label: "Returned", tone: "rust" },
  approved: { label: "Approved", tone: "moss" },
  closed: { label: "Closed", tone: "neutral" },
};

export function SurveyStatusBadge({ status }: { status: SurveyStatus }) {
  const entry = SURVEY_STATUS[status];
  return (
    <Badge tone={entry.tone} dot>
      {entry.label}
    </Badge>
  );
}

export function statusLabel(status: SurveyStatus): string {
  return SURVEY_STATUS[status].label;
}
