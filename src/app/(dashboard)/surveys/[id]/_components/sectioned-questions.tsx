import { Card } from "@/components/ui/card";
import type { SurveyQuestion } from "@/types/question";
import type { SurveyDetail } from "@/types/survey";

/** A survey's questions as one card per section (title in the header, one
 * divided row per question), numbered continuously across sections. `render`
 * draws the contents of one row. */
export function SectionedQuestions({
  survey,
  render,
}: {
  survey: SurveyDetail;
  render: (question: SurveyQuestion, number: number) => React.ReactNode;
}) {
  let n = 0;
  return (
    <div className="space-y-4">
      {survey.sections
        .filter((s) => s.questions.length > 0)
        .map((section) => (
          <Card key={section.id}>
            <div className="border-b border-line px-5 py-3">
              <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
              {section.description && <p className="mt-0.5 text-xs text-ink-muted">{section.description}</p>}
            </div>
            <ul>{section.questions.map((q) => render(q, ++n))}</ul>
          </Card>
        ))}
    </div>
  );
}
