import { Avatar } from "@/components/shared/avatar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { SurveyDetail } from "@/types/survey";
import { StageBar } from "./workflow-stepper";

/** Each respondent with how far their questions have got, so it is plain who
 * is done and who is holding the survey up. */
export function RespondentsCard({ survey, meId }: { survey: SurveyDetail; meId?: string }) {
  if (survey.respondents.length === 0) return null;
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle>Respondents</CardTitle>
        <span className="text-xs text-ink-faint">{survey.respondents.length}</span>
      </CardHeader>
      <ul>
        {survey.respondents.map(({ person, stats }) => {
          const open = stats.awaiting_response + stats.returned;
          return (
            <li key={person.id} className="space-y-2 border-b border-line px-5 py-3 last:border-b-0">
              <div className="flex items-center gap-2">
                <Avatar name={person.full_name} className="h-7 w-7" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">
                    {person.full_name}
                    {person.id === meId && <span className="ml-1.5 rounded bg-brand-soft px-1.5 py-0.5 text-2xs font-semibold text-brand-strong">You</span>}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {stats.approved} of {stats.total} approved
                    {open > 0 && ` · ${open} still with them`}
                  </div>
                </div>
              </div>
              <StageBar stats={stats} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
