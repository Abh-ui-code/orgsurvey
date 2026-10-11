"use client";

import { Check, Circle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <CardHeader>
        <CardTitle>Publish</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {survey.readiness.map((item) => (
            <li key={item.key} className={cn("flex items-center gap-2 text-sm", item.ok ? "text-ink" : "text-ink-muted")}>
              {item.ok ? <Check className="h-4 w-4 text-moss" /> : <Circle className="h-4 w-4 text-ink-faint" />}
              {item.label}
            </li>
          ))}
        </ul>
        <Button className="w-full" disabled={!ready || dirty} onClick={() => setConfirm(true)}>
          Publish survey
        </Button>
        {dirty && <p className="text-xs text-amber">Save your changes before publishing.</p>}
        <p className="text-xs text-ink-faint">
          Publishing freezes the questions and sends the survey to {responder}. You can still move the due date or swap a person afterwards.
        </p>
      </CardContent>

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
