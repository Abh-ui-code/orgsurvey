import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { SurveyQuestion } from "@/types/question";
import type { SurveyDetail } from "@/types/survey";

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
                  {section.gri && <Badge tone="brand">GRI</Badge>}
                </h3>
                {section.gri && (
                  <a href={section.gri.pdf} target="_blank" rel="noreferrer" className="text-xs text-brand-strong hover:underline">
                    Read the standard (PDF)
                  </a>
                )}
              </div>
              {section.description && <p className="mt-0.5 text-xs text-ink-muted">{section.description}</p>}
            </div>
            <ul>{section.questions.map((q) => render(q, q.number))}</ul>
          </Card>
        ))}
    </div>
  );
}
