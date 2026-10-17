import { Avatar } from "@/components/shared/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HistoryEntry, SurveyDetail } from "@/types/survey";
import { ACTION_META } from "../../../surveys/[id]/_components/activity-card";
import { AUDIENCE_LABEL } from "../../../surveys/[id]/_components/question-comments";
import { gapText, groupRounds, numberQuestions, roleOf, type Round } from "../../_lib";

/** How a round ended, in words: the line under its heading. */
function outcome(round: Round): string {
  const last = round.events[round.events.length - 1];
  switch (last.action) {
    case "approved":
      return "Approved";
    case "closed":
      return "Closed by an administrator";
    case "returned":
      return last.audience ? AUDIENCE_LABEL[last.audience] : "Returned";
    case "reviewed":
      return "Passed review, waiting for approval";
    case "submitted":
      return "Waiting for review";
    default:
      return round.title === "Setup" ? "Created and handed to the respondent" : "In progress";
  }
}

/** The survey's whole path as a timeline, one block per round (setup, then
 * one per submission). Returns stand out, carry who they went to, and list the
 * comments pinned to questions. The time between steps shows where it waited. */
export function Journey({ survey }: { survey: SurveyDetail }) {
  const rounds = groupRounds(survey.history);
  const questions = numberQuestions(survey);
  let previous: HistoryEntry | null = null;

  return (
    <div className="space-y-8">
      {rounds.map((round) => (
        <section key={round.key} aria-label={round.title}>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
            <h3 className="font-display text-base font-semibold text-ink">{round.title}</h3>
            <span className="text-sm text-ink-muted">{outcome(round)}</span>
          </div>
          <ol className="relative ml-4 border-l-2 border-line">
            {round.events.map((event) => {
              const meta = ACTION_META[event.action];
              const gap = previous ? gapText(previous.at, event.at) : null;
              previous = event;
              const returned = event.action === "returned";
              return (
                <li key={event.id} className="relative pb-5 pl-8 last:pb-0">
                  <span
                    className={cn("absolute -left-[17px] top-0 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-paper", meta.tone)}
                  >
                    <meta.icon className="h-4 w-4" />
                  </span>
                  {gap && <p className="-mt-1 mb-1.5 text-xs text-ink-faint">{gap}</p>}
                  <div className={cn("rounded-lg border px-4 py-3", returned ? "border-rust/30 bg-rust-soft/50" : "border-line bg-paper-raised")}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-semibold text-ink">{returned && event.audience ? AUDIENCE_LABEL[event.audience] : meta.label}</span>
                      {returned && <Badge tone="rust">Sent back</Badge>}
                      <span className="ml-auto text-xs text-ink-faint">{formatDateTime(event.at)}</span>
                    </div>
                    {event.by && (
                      <div className="mt-2 flex items-center gap-2">
                        <Avatar name={event.by.full_name} className="h-6 w-6 text-2xs" />
                        <span className="text-sm text-ink">{event.by.full_name}</span>
                        <span className="rounded bg-paper-sunken px-1.5 py-0.5 text-2xs font-medium text-ink-muted">{roleOf(survey, event.by)}</span>
                      </div>
                    )}
                    {event.comment && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">“{event.comment}”</p>}
                    {event.question_comments.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {event.question_comments.map((c) => {
                          const q = questions.get(c.question_id);
                          return (
                            <li key={c.id} className="rounded-md border border-rust/20 bg-paper-raised px-3 py-2">
                              <p className="text-xs text-ink-muted">
                                <span className="mr-1.5 font-mono-data font-semibold text-rust">Q{q?.n ?? "?"}</span>
                                {q?.question.text ?? "Question removed"}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{c.text}</p>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
