import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { disclosureLabel, questionNumber } from "@/lib/gri";
import type { SurveyQuestion } from "@/types/question";
import type { SurveyDetail } from "@/types/survey";

/** The number a standard's question carries in its PDF ("305-1 a"), shown beside its Q number. Nothing for other questions. */
export function PdfNumber({ question }: { question: SurveyQuestion }) {
  if (!question.gri_ref || !question.gri_title) return null;
  return <span className="mr-1.5 font-mono-data text-xs text-brand-strong">{questionNumber(question.gri_ref, question.gri_item)}</span>;
}

/** A survey's questions as one card per section (title in the header, one
 * divided row per question), numbered as in the whole survey. `render` draws
 * the contents of one row; `questions` narrows what is shown (filters). */
export function SectionedQuestions({
  survey,
  render,
  show,
}: {
  survey: SurveyDetail;
  render: (question: SurveyQuestion, number: number) => React.ReactNode;
  show?: (question: SurveyQuestion) => boolean;
}) {
  return (
    <div className="space-y-4">
      {survey.sections
        .map((section) => ({ ...section, questions: show ? section.questions.filter(show) : section.questions }))
        .filter((s) => s.questions.length > 0)
        .map((section) => (
          <Card key={section.id}>
            <div className="border-b border-line px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  {section.title}
                  {section.gri && <Badge tone="brand">{section.gri.framework.toUpperCase()}</Badge>}
                </h3>
                {section.gri && (
                  <a href={section.gri.pdf} target="_blank" rel="noreferrer" className="text-xs text-brand-strong hover:underline">
                    Read the standard (PDF)
                  </a>
                )}
              </div>
              {section.description && <p className="mt-0.5 text-xs text-ink-muted">{section.description}</p>}
            </div>
            <ul>
              {section.questions.map((q, i) => {
                const prev = section.questions[i - 1];
                const startsGroup = section.gri && q.gri_title && (!prev || prev.gri_ref !== q.gri_ref || prev.gri_title !== q.gri_title);
                return (
                  <Fragment key={q.id}>
                    {startsGroup && (
                      <li className="border-t border-line bg-paper-sunken/60 px-5 py-2 text-sm font-semibold text-ink first:border-t-0">
                        <span className="font-mono-data text-brand-strong">{disclosureLabel(q.gri_ref)}</span> {q.gri_title}
                      </li>
                    )}
                    {render(q, q.number)}
                  </Fragment>
                );
              })}
            </ul>
          </Card>
        ))}
    </div>
  );
}
