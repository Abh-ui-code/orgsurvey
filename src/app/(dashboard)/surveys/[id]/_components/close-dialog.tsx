"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/shared/form-dialog";
import { Textarea } from "@/components/ui/textarea";
import type { SurveyDetail } from "@/types/survey";
import { useCloseSurvey } from "../_hooks/use-survey-actions";

/** Withdraws a survey that is in progress, with an optional reason that is
 * kept in its activity log. */
export function CloseDialog({ survey, open, onClose }: { survey: SurveyDetail; open: boolean; onClose: () => void }) {
  const close = useCloseSurvey(survey.id);
  const [comment, setComment] = useState("");

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Close this survey?"
      submitLabel="Close survey"
      saving={close.isPending}
      onSubmit={() =>
        close.mutate(comment, {
          onSuccess: () => {
            toast.success("Survey closed");
            setComment("");
            onClose();
          },
          onError: (e) => toast.error((e as Error).message),
        })
      }
    >
      <p className="text-sm text-ink-muted">Closing withdraws it from everyone&apos;s tasks. It can&apos;t be reopened, but you can duplicate it.</p>
      <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Reason (optional)" />
    </FormDialog>
  );
}
