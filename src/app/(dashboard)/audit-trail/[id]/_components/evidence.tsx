import { AttachmentList } from "../../../surveys/[id]/_components/question-attachments";
import type { SubmissionDetail } from "@/types/survey";

const toFiles = (files: SubmissionDetail["files"]) => files.map((f) => ({ ...f, submitted: true, kind: "response" as const }));

/** What went with an answer when it was submitted: the respondent's note and attached files. */
export function Evidence({ surveyId, detail }: { surveyId: string; detail?: SubmissionDetail }) {
  if (!detail || (!detail.note && detail.files.length === 0)) return null;
  return (
    <div className="mt-1.5 space-y-1.5 text-xs">
      {detail.note && (
        <p className="whitespace-pre-wrap text-ink-muted">
          <span className="font-semibold text-ink">Respondent&apos;s note: </span>
          {detail.note}
        </p>
      )}
      {detail.files.length > 0 && <AttachmentList surveyId={surveyId} files={toFiles(detail.files)} />}
    </div>
  );
}
