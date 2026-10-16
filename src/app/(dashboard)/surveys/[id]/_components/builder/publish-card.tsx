"use client";

import { Check, Circle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type { SurveyDetail } from "@/types/survey";
import { usePublishSurvey } from "../../_hooks/use-survey-actions";

/** The pre-flight checklist and the Publish button. Publishing is disabled
 * until everything is ready and the details are saved. */
export function PublishCard({ survey, dirty }: { survey: SurveyDetail; dirty: boolean }) {
  const publish = usePublishSurvey(survey.id);
  const [confirm, setConfirm] = useState(false);
  const ready = survey.readiness.every((r) => r.ok);
  const responder = survey.responder?.full_name ?? "the responder";

  return (
    <Card>
      <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">Ready to publish?</h3>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
            {survey.readiness.map((item) => (
              <li key={item.key} className={cn("flex items-center gap-1.5 text-sm", item.ok ? "text-ink" : "text-ink-muted")}>
                {item.ok ? <Check className="h-4 w-4 text-moss" /> : <Circle className="h-4 w-4 text-ink-faint" />}
                {item.label}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-faint">
            {dirty
              ? "Save your changes before publishing."
              : `Publishing freezes the questions and sends the survey to ${responder}. You can still move the due date or swap a person afterwards.`}
          </p>
        </div>
        <Button className="shrink-0" disabled={!ready || dirty} onClick={() => setConfirm(true)}>
          Publish
        </Button>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Publish this survey?"
        description={`“${survey.title}” goes to ${responder} to respond. Its ${survey.question_count} question(s) can no longer be edited; duplicate the survey to change them.`}
        confirmLabel="Publish"
        loading={publish.isPending}
        onConfirm={() =>
          publish.mutate(undefined, {
            onSuccess: () => {
              toast.success("Survey published");
              setConfirm(false);
            },
            onError: (e) => {
              toast.error((e as Error).message);
              setConfirm(false);
            },
          })
        }
      />
    </Card>
  );
}
