import { Avatar } from "@/components/shared/avatar";
import { QUESTION_STATUS } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import type { Person } from "@/types/common";
import { QUESTION_STATUSES, type QuestionStatus, type StageCounts, type SurveyDetail } from "@/types/survey";

/** Drawn in this order so the bar reads left to right as "furthest along first". */
const BAR_ORDER: QuestionStatus[] = ["approved", "awaiting_approval", "awaiting_review", "returned", "awaiting_response"];

/** A stacked bar of where the questions are, with a count under each stage. */
export function StageBar({ stats, className }: { stats: StageCounts; className?: string }) {
  return (
    <div
      role="img"
      aria-label={QUESTION_STATUSES.map((s) => `${stats[s]} ${QUESTION_STATUS[s].short}`).join(", ")}
      className={cn("flex h-2 overflow-hidden rounded-full bg-paper-sunken", className)}
    >
      {BAR_ORDER.map((s) =>
        stats[s] > 0 ? <span key={s} className={cn("h-full transition-all duration-500", QUESTION_STATUS[s].bar)} style={{ width: `${(stats[s] / stats.total) * 100}%` }} /> : null,
      )}
    </div>
  );
}

function PersonLine({ label, person, meId, note }: { label: string; person: Person | null; meId?: string; note?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">{label}</div>
      {person ? (
        <div className="mt-1.5 flex items-center gap-2">
          <Avatar name={person.full_name} className="h-7 w-7" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-ink">
              {person.full_name}
              {person.id === meId && <span className="ml-1.5 rounded bg-brand-soft px-1.5 py-0.5 text-2xs font-semibold text-brand-strong">You</span>}
            </div>
            <div className="truncate text-xs text-ink-muted">{note ?? person.email}</div>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 text-sm text-ink-faint">Not assigned</div>
      )}
    </div>
  );
}

/** Question progress at a glance: how many questions are at each stage, and who
 * handles them (the respondents, the reviewer, the approver). Counts cover the
 * questions the signed-in person can see, so a respondent sees their own. */
export function WorkflowStepper({ survey, meId }: { survey: SurveyDetail; meId?: string }) {
  const stats = survey.question_stats;
  const respondents = survey.respondents;
  const own = survey.respondents.length === 0; // a respondent: only their own questions are in view
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">{own ? "Your questions" : "Question progress"}</h3>
          <span className="text-sm text-ink-muted">
            <span className="font-mono-data font-semibold text-ink">{stats.approved}</span> of {stats.total} approved
          </span>
        </div>
        <StageBar stats={stats} className="h-2.5" />
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
          {BAR_ORDER.slice().reverse().map((status) => (
            <li key={status} className={cn("flex items-center gap-2 text-xs", stats[status] === 0 && "opacity-50")}>
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", QUESTION_STATUS[status].bar)} />
              <span className="text-ink-muted">{QUESTION_STATUS[status].short}</span>
              <span className="font-mono-data font-semibold text-ink">{stats[status]}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
        <div className="min-w-0">
          <div className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">{respondents.length > 1 ? "Respondents" : "Respondent"}</div>
          {respondents.length > 0 ? (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex -space-x-2">
                {respondents.slice(0, 4).map((r) => (
                  <Avatar key={r.person.id} name={r.person.full_name} className="h-7 w-7 ring-2 ring-paper-raised" />
                ))}
              </div>
              <div className="min-w-0 text-sm text-ink">
                {respondents.length === 1 ? respondents[0].person.full_name : `${respondents.length} respondents`}
                <div className="truncate text-xs text-ink-muted">One person per question</div>
              </div>
            </div>
          ) : (
            <div className="mt-1.5 text-sm text-ink-muted">You answer your own questions</div>
          )}
        </div>
        <PersonLine label="Reviewer" person={survey.reviewer} meId={meId} />
        <PersonLine label="Approver" person={survey.approver} meId={meId} />
      </div>
    </div>
  );
}
