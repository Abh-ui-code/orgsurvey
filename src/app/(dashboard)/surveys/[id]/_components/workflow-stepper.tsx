import { Check } from "lucide-react";
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

/** Responder → Reviewer → Approver, with the current step highlighted. */
export function WorkflowStepper({ survey }: { survey: SurveyDetail }) {
  const states = stepStates(survey.status);
  const steps: { label: string; person: Person | null }[] = [
    { label: "Responder", person: survey.responder },
    { label: "Reviewer", person: survey.reviewer },
    { label: "Approver", person: survey.approver },
  ];

  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {steps.map((step, i) => {
        const state = states[i];
        return (
          <li
            key={step.label}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3",
              state === "current" ? "border-brand bg-brand-soft/40" : "border-line bg-paper-raised",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                state === "done" && "bg-moss text-white",
                state === "current" && "bg-brand text-brand-contrast",
                state === "todo" && "bg-paper-sunken text-ink-faint",
              )}
            >
              {state === "done" ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">{step.label}</div>
              <div className="truncate text-sm font-medium text-ink">{step.person?.full_name ?? "Not assigned"}</div>
              <div className="truncate text-xs text-ink-muted">{step.person?.email}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
