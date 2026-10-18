import type { Person } from "@/types/common";
import type { SurveyQuestion } from "@/types/question";
import type { HistoryEntry, SurveyDetail } from "@/types/survey";

/** What a person was acting as on this survey. Anyone else who acted
 * (creating, publishing, closing) is an administrator. */
export function roleOf(survey: SurveyDetail, person: Person | null): string {
  if (!person) return "System";
  if (survey.respondents.some((r) => r.person.id === person.id)) return "Respondent";
  if (person.id === survey.reviewer?.id) return "Reviewer";
  if (person.id === survey.approver?.id) return "Approver";
  return "Administrator";
}

export interface NumberedQuestion {
  n: number;
  question: SurveyQuestion;
  section: string;
}

/** Every question with its number (Q1, Q2 ... continuing across sections), by id. */
export function numberQuestions(survey: SurveyDetail): Map<string, NumberedQuestion> {
  const map = new Map<string, NumberedQuestion>();
  let n = 0;
  for (const section of survey.sections) for (const question of section.questions) map.set(question.id, { n: question.number ?? ++n, question, section: section.title });
  return map;
}

/** "3 days later", "2 hours later", "a few minutes later" between two ISO times. */
export function gapText(from: string, to: string): string {
  const minutes = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000));
  if (minutes < 5) return "moments later";
  if (minutes < 60) return `${minutes} minutes later`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} later`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} later`;
}

/** Setup events (before anyone answered) and the question workflow after them. */
export function splitSetup(history: HistoryEntry[]): { setup: HistoryEntry[]; flow: HistoryEntry[] } {
  const firstStep = history.findIndex((h) => h.question_ids.length > 0 || h.action === "closed");
  const at = firstStep === -1 ? history.length : firstStep;
  return { setup: history.slice(0, at), flow: history.slice(at) };
}

/** Whole days between publishing and the end (approval or closing), or now if still moving. */
export function daysInFlow(survey: SurveyDetail): number | null {
  if (!survey.published_at) return null;
  const end = [...survey.history].reverse().find((h) => h.action === "approved" || h.action === "closed");
  const to = end ? new Date(end.at).getTime() : Date.now();
  return Math.max(0, Math.floor((to - new Date(survey.published_at).getTime()) / 86_400_000));
}
