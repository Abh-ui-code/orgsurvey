"use client";

import { Paperclip, X } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { downloadFile } from "@/lib/api";
import type { Attachment } from "@/types/question";
import { useDeleteAttachment, useUploadAttachment } from "../_hooks/use-survey-actions";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt";
const MAX_FILES = 5;

const sizeOf = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

function FileChip({ surveyId, file, onRemove }: { surveyId: string; file: Attachment; onRemove?: () => void }) {
  return (
    <li className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-paper-sunken py-0.5 pl-2.5 pr-1.5 text-xs">
      <Paperclip className="h-3 w-3 shrink-0 text-ink-faint" />
      <button
        type="button"
        onClick={() => downloadFile(`/surveys/${surveyId}/attachments/${file.id}/`, file.name).catch((e) => toast.error((e as Error).message))}
        className="truncate font-medium text-brand-strong hover:underline"
        title={file.name}
      >
        {file.name}
      </button>
      <span className="shrink-0 text-ink-faint">{sizeOf(file.size)}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`} className="rounded-full p-0.5 text-ink-faint hover:bg-paper hover:text-rust">
          <X className="h-3 w-3" />
        </button>
      )}
    </li>
  );
}

/** The files on a question, read-only (reviewer, approver, administrator, or a submitted question). */
export function AttachmentList({ surveyId, files }: { surveyId: string; files: Attachment[] }) {
  if (!files.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Attached files">
      {files.map((f) => (
        <FileChip key={f.id} surveyId={surveyId} file={f} />
      ))}
    </ul>
  );
}

/** The respondent's files on an open question, with a button to add and a cross to remove. */
export function AttachmentPicker({
  surveyId,
  questionId,
  files,
  kind = "response",
}: {
  surveyId: string;
  questionId: string;
  files: Attachment[];
  /** "review" when a reviewer or approver is attaching to the note they are sending. */
  kind?: "response" | "review";
}) {
  const upload = useUploadAttachment(surveyId);
  const remove = useDeleteAttachment(surveyId);
  const input = useRef<HTMLInputElement>(null);

  function pick(list: FileList | null) {
    const chosen = Array.from(list ?? []);
    if (input.current) input.current.value = "";
    chosen.slice(0, MAX_FILES - files.length).reduce(
      (chain, file) =>
        chain.then(() => upload.mutateAsync({ questionId, file, kind }).then(() => undefined, (e) => void toast.error(`${file.name}: ${(e as Error).message}`))),
      Promise.resolve(),
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => pick(e.target.files)} />
      <button
        type="button"
        disabled={upload.isPending || files.length >= MAX_FILES}
        onClick={() => input.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-brand hover:bg-brand-soft disabled:opacity-50"
      >
        <Paperclip className="h-3.5 w-3.5" /> {upload.isPending ? "Uploading…" : files.length ? "Attach another file" : "Attach files"}
      </button>
      <ul className="contents">
        {files.map((f) => (
          <FileChip key={f.id} surveyId={surveyId} file={f} onRemove={() => remove.mutate(f.id, { onError: (e) => toast.error((e as Error).message) })} />
        ))}
      </ul>
      {files.length === 0 && <span className="text-xs text-ink-faint">PDF, image, Word, Excel, CSV or text · up to 5 files, 10 MB each</span>}
    </div>
  );
}
