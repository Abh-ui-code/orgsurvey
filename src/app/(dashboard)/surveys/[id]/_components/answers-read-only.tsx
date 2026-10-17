"use client";

import { Download, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { formatAnswer } from "@/components/shared/answer-field";
import { Button } from "@/components/ui/button";
import { downloadCsv, slug } from "@/lib/csv";
import { questionTypeLabel } from "@/types/question";
import type { SurveyDetail } from "@/types/survey";
import { Textarea } from "@/components/ui/textarea";
import { commentsByQuestion, QuestionComments } from "./question-comments";
import { SectionedQuestions } from "./sectioned-questions";

/** The submitted response, as the reviewer, approver and admin see it, with a
 * CSV export for filing or analysis. Notes from earlier returns show under
 * their question. When `notes` and `onNote` are given (the reviewer or
 * approver deciding), each question also gets a box to pin a new note. */
export function AnswersReadOnly({
  survey,
  notes,
  onNote,
}: {
  survey: SurveyDetail;
  notes?: Record<string, string>;
  onNote?: (questionId: string, text: string) => void;
}) {
  const past = commentsByQuestion(survey.history);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Survey", survey.title],
      ["Category", survey.category.label],
      ["Aimed at", survey.target_unit.name],
      ["Status", survey.status.replace("_", " ")],
      ["Responder", survey.responder?.full_name ?? ""],
      ["Reviewer", survey.reviewer?.full_name ?? ""],
      ["Approver", survey.approver?.full_name ?? ""],
      [],
      ["Section", "Question", "Type", "Answer"],
    ];
    for (const section of survey.sections) {
      for (const q of section.questions) rows.push([section.title, q.text, questionTypeLabel(q.type), formatAnswer(survey.answers[q.id])]);
    }
    downloadCsv(`${slug(survey.title)}-response`, rows);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Response</h2>
          <p className="mt-0.5 text-xs text-ink-faint">Submitted by {survey.responder?.full_name ?? "the responder"}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>
      <SectionedQuestions
        survey={survey}
        render={(q, n) => {
          const answer = formatAnswer(survey.answers[q.id]);
          const empty = !answer || answer === "—";
          return (
            <li key={q.id} className="border-b border-line px-5 py-3 last:border-b-0">
              <p className="text-sm text-ink">
                <span className="mr-1.5 font-mono-data text-xs text-ink-faint">Q{n}</span>
                {q.text}
              </p>
              <p className={empty ? "mt-1 text-sm italic text-ink-faint" : "mt-1 whitespace-pre-wrap text-sm font-medium text-ink"}>{empty ? "No answer" : answer}</p>
              <QuestionComments comments={past[q.id]} />
              {onNote && (open[q.id] || notes?.[q.id] ? (
                <Textarea
                  rows={2}
                  className="mt-2"
                  value={notes?.[q.id] ?? ""}
                  onChange={(e) => onNote(q.id, e.target.value)}
                  placeholder="Note on this question (sent when you return the survey)"
                  aria-label={`Note on question ${n}`}
                />
              ) : (
                <button type="button" onClick={() => setOpen({ ...open, [q.id]: true })} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline">
                  <MessageSquarePlus className="h-3.5 w-3.5" /> Add comment
                </button>
              ))}
            </li>
          );
        }}
      />
    </div>
  );
}
