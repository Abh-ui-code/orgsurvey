import { Check } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { cn } from "@/lib/utils";
import type { Person } from "@/types/common";
import type { SurveyDetail, SurveyStatus } from "@/types/survey";

type StepState = "done" | "current" | "todo";

/** Which of the three people the survey is currently waiting on. A returned
 * survey is back with the responder. */
function stepStates(status: SurveyStatus): [StepState, StepState, StepState] {
  switch (status) {
    case "awaiting_response":
    case "returned":
      return ["current", "todo", "todo"];
    case "awaiting_review":
      return ["done", "current", "todo"];
    case "awaiting_approval":
      return ["done", "done", "current"];
    case "approved":
      return ["done", "done", "done"];
    default:
      return ["todo", "todo", "todo"]; // draft and closed have no active step
  }
}

const CAPTION: Record<StepState, string> = { done: "Completed", current: "Waiting on", todo: "Up next" };

/** Responder → Reviewer → Approver as a connected progress track, with the
 * current step highlighted and the signed-in person marked "You". */
export function WorkflowStepper({ survey, meId }: { survey: SurveyDetail; meId?: string }) {
  const states = stepStates(survey.status);
  const steps: { label: string; person: Person | null }[] = [
    { label: "Responder", person: survey.responder },
    { label: "Reviewer", person: survey.reviewer },
    { label: "Approver", person: survey.approver },
  ];
  const returned = survey.status === "returned";

  return (
    <ol className="grid gap-3 sm:grid-cols-3 sm:gap-0">
      {steps.map((step, i) => {
        const state = states[i];
        const last = i === steps.length - 1;
        return (
          <li key={step.label} className="relative flex gap-3 sm:flex-col sm:items-start sm:pr-4">
            {/* connector */}
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[15px] top-9 h-[calc(100%-1rem)] w-0.5 sm:left-9 sm:top-[15px] sm:h-0.5 sm:w-[calc(100%-2.5rem)]",
                  state === "done" ? "bg-moss" : "bg-line",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-paper-raised",
                state === "done" && "bg-moss text-white",
                state === "current" && "bg-brand text-brand-contrast",
                state === "todo" && "bg-paper-sunken text-ink-faint",
              )}
            >
              <span className="relative">{state === "done" ? <Check className="h-4 w-4" /> : i + 1}</span>
            </span>
            <div className="min-w-0 sm:mt-3">
              <div className={cn("text-2xs font-semibold uppercase tracking-wider", state === "current" ? (returned ? "text-rust" : "text-brand-strong") : "text-ink-faint")}>
                {step.label} · {state === "current" && returned ? "Revising" : CAPTION[state]}
              </div>
              {step.person ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <Avatar name={step.person.full_name} className="h-7 w-7" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">
                      {step.person.full_name}
                      {step.person.id === meId && <span className="ml-1.5 rounded bg-brand-soft px-1.5 py-0.5 text-2xs font-semibold text-brand-strong">You</span>}
                    </div>
                    <div className="truncate text-xs text-ink-muted">{step.person.email}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-1.5 text-sm text-ink-faint">Not assigned</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
