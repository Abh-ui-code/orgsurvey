import type { SurveyQuestion } from "@/types/question";
import type { SurveyDetail } from "@/types/survey";

/** A survey's questions grouped under their section titles, numbered
 * continuously across sections. `render` draws one question. */
export function SectionedQuestions({
  survey,
  render,
}: {
  survey: SurveyDetail;
  render: (question: SurveyQuestion, number: number) => React.ReactNode;
}) {
  let n = 0;
  return (
    <div className="space-y-8">
      {survey.sections
        .filter((s) => s.questions.length > 0)
        .map((section) => (
          <div key={section.id} className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-brand-strong">{section.title}</h3>
              {section.description && <p className="mt-0.5 text-sm text-ink-muted">{section.description}</p>}
            </div>
            {section.questions.map((q) => render(q, ++n))}
          </div>
        ))}
    </div>
  );
}
