import { ClipboardList } from "lucide-react";
import { formatAnswer } from "@/components/shared/answer-field";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { questionTypeLabel } from "@/types/question";
import type { SurveyDetail } from "@/types/survey";

/** What was answered each time questions were submitted, one column per
 * submission (a respondent's batch). A question a submission didn't include shows a
 * dash. An answer that changed since that question's previous submission is
 * highlighted, so a revision after a return is visible at a glance. */
export function AnswersByRound({ survey }: { survey: SurveyDetail }) {
  const submissions = survey.history.filter((h) => h.action === "submitted");
  const recorded = submissions.filter((h) => h.question_ids.length > 0 || Object.keys(h.snapshot).length > 0);

  if (recorded.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ClipboardList}
          title="No answers recorded yet"
          description={submissions.length > 0 ? "This survey was submitted before answers were kept for each round." : "No respondent has submitted yet."}
        />
      </Card>
    );
  }

  let n = 0;
  return (
    <div className="space-y-3">
      {recorded.length > 1 && (
        <p className="flex items-center gap-2 text-xs text-ink-muted">
          <span className="h-3 w-3 rounded-sm bg-amber-soft ring-1 ring-amber/40" /> Answer changed since the previous submission
        </p>
      )}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-paper-sunken/60 text-left text-xs text-ink-muted">
              <th className="sticky left-0 z-10 w-[38%] bg-paper-sunken px-5 py-3 font-medium">Question</th>
              {recorded.map((h, i) => (
                <th key={h.id} className="px-4 py-3 font-medium">
                  <div className="text-ink">Submission {i + 1}</div>
                  <div className="font-normal text-ink-muted">
                    {h.by?.full_name}
                    {h.question_ids.length > 0 && ` · ${h.question_ids.length} question${h.question_ids.length === 1 ? "" : "s"}`}
                  </div>
                  <div className="font-normal text-ink-faint">{formatDateTime(h.at)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {survey.sections
              .filter((s) => s.questions.length > 0)
              .map((section) => (
                <SectionRows key={section.id} title={section.title} colSpan={recorded.length + 1}>
                  {section.questions.map((q) => {
                    n += 1;
                    return (
                      <tr key={q.id} className="border-b border-line last:border-b-0 align-top">
                        <td className="sticky left-0 z-10 bg-paper-raised px-5 py-3">
                          <p className="text-ink">
                            <span className="mr-1.5 font-mono-data text-xs text-ink-faint">Q{n}</span>
                            {q.text}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-faint">
                            {questionTypeLabel(q.type)}
                            {q.required ? " · required" : ""}
                          </p>
                        </td>
                        {recorded.map((h, i) => {
                          const covers = h.question_ids.length === 0 || h.question_ids.includes(q.id);
                          if (!covers) {
                            return (
                              <td key={h.id} className="px-4 py-3 text-ink-faint">
                                —
                              </td>
                            );
                          }
                          const value = formatAnswer(h.snapshot[q.id]);
                          const earlier = recorded.slice(0, i).reverse().find((r) => r.question_ids.length === 0 || r.question_ids.includes(q.id));
                          const before = earlier ? formatAnswer(earlier.snapshot[q.id]) : value;
                          const empty = !value || value === "—";
                          return (
                            <td key={h.id} className={cn("px-4 py-3", value !== before && "bg-amber-soft")}>
                              <span className={empty ? "italic text-ink-faint" : "whitespace-pre-wrap font-medium text-ink"}>{empty ? "No answer" : value}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </SectionRows>
              ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function SectionRows({ title, colSpan, children }: { title: string; colSpan: number; children: React.ReactNode }) {
  return (
    <>
      <tr className="border-b border-line bg-paper-sunken/40">
        <th colSpan={colSpan} className="px-5 py-2 text-left text-xs font-semibold text-ink-muted">
          {title}
        </th>
      </tr>
      {children}
    </>
  );
}
