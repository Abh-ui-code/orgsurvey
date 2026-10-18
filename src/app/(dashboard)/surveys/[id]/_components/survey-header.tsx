"use client";

import { ArrowLeft, Copy, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DueBadge } from "@/components/shared/due-badge";
import { SurveyStatusBadge } from "@/components/ui/status-badge";
import { useUnits } from "@/hooks/use-units";
import { unitPath } from "@/lib/org";
import { LIVE_STATUSES, type SurveyDetail } from "@/types/survey";
import { useDeleteSurvey, useDuplicateSurvey } from "../_hooks/use-survey-actions";
import { CloseDialog } from "./close-dialog";

/** Title, category, status and (for admins) duplicate / close / delete. */
export function SurveyHeader({ survey, isAdmin }: { survey: SurveyDetail; isAdmin: boolean }) {
  const router = useRouter();
  const units = useUnits();
  const duplicate = useDuplicateSurvey(survey.id);
  const del = useDeleteSurvey(survey.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const isDraft = survey.status === "draft";
  const isLive = LIVE_STATUSES.includes(survey.status);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/surveys" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> All surveys
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-ink">{survey.title}</h1>
            <SurveyStatusBadge status={survey.status} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {survey.category.label}
            {` · ${survey.status === "draft" || isAdmin ? survey.question_count : survey.my_question_count} question${(survey.status === "draft" || isAdmin ? survey.question_count : survey.my_question_count) === 1 ? "" : "s"}`}
            {` · ${unitPath(units.data ?? [], survey.target_unit.id) || survey.target_unit.name}`}
          </p>
          {!isDraft && survey.description && <p className="mt-2 max-w-2xl text-sm text-ink-muted">{survey.description}</p>}
          {!isDraft && (
            <div className="mt-2 text-sm text-ink-muted">
              Due <DueBadge dueDate={survey.due_date} status={survey.status} overdue={survey.is_overdue} />
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              loading={duplicate.isPending}
              onClick={() =>
                duplicate.mutate(undefined, {
                  onSuccess: (copy) => {
                    toast.success("Duplicated as a draft");
                    router.push(`/surveys/${copy.id}`);
                  },
                  onError: (e) => toast.error((e as Error).message),
                })
              }
            >
              <Copy className="h-4 w-4" /> Duplicate
            </Button>
            {isLive && (
              <Button variant="secondary" onClick={() => setConfirmClose(true)}>
                <XCircle className="h-4 w-4" /> Close
              </Button>
            )}
            <Button variant="ghost" size="icon" className="text-ink-muted hover:text-rust" onClick={() => setConfirmDelete(true)} aria-label="Delete survey">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <CloseDialog survey={survey} open={confirmClose} onClose={() => setConfirmClose(false)} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        variant="danger"
        title="Delete this survey?"
        description="The survey, its response and its history are removed. This cannot be undone."
        confirmLabel="Delete"
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(undefined, {
            onSuccess: () => {
              toast.success("Survey deleted");
              router.push("/surveys");
            },
            onError: (e) => toast.error((e as Error).message),
          })
        }
      />
    </>
  );
}
