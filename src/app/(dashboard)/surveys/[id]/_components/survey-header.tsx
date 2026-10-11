"use client";

import { ArrowLeft, Copy, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CategoryBadge } from "@/components/shared/category-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { SurveyStatusBadge } from "@/components/ui/status-badge";
import { useUnits } from "@/hooks/use-units";
import { formatDate } from "@/lib/format";
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
      <Link href="/surveys" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Surveys
      </Link>
      <PageHeader
        className="!mb-0"
        title={survey.title}
        description={`${unitPath(units.data ?? [], survey.target_unit.id)}${isDraft ? "" : ` · Due ${formatDate(survey.due_date)}`}`}
        actions={
          <>
            <CategoryBadge label={survey.category.label} color={survey.category.color} />
            <SurveyStatusBadge status={survey.status} />
            {isAdmin && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
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
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </Button>
                {isLive && (
                  <Button variant="secondary" size="sm" onClick={() => setConfirmClose(true)}>
                    <XCircle className="h-3.5 w-3.5" /> Close
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} aria-label="Delete survey">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </>
        }
      />

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
