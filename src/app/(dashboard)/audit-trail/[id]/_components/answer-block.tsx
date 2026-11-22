import { AnswerView, formatAnswer } from "@/components/shared/answer-field";
import type { SurveyQuestion } from "@/types/question";
import type { AnswerValue } from "@/types/survey";

/** A submitted answer in the audit trail: a real table for table questions (with the
 * columns and rows the respondent added), the plain value for the rest, and a quiet
 * "No answer" when nothing was given. */
export function AnswerBlock({ question, value }: { question?: SurveyQuestion; value: AnswerValue | undefined }) {
  if (!question) return <p className="text-sm font-medium text-ink">{String(formatAnswer(value))}</p>;
  if (formatAnswer(value, question) === "—") return <p className="text-sm italic text-ink-faint">No answer</p>;
  return <AnswerView question={question} value={value} />;
}
