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
              <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
              {section.description && <p className="mt-0.5 text-xs text-ink-muted">{section.description}</p>}
            </div>
            <ul>{section.questions.map((q) => render(q, q.number))}</ul>
          </Card>
        ))}
    </div>
  );
}
