"use client";

import { Download } from "lucide-react";
import { formatAnswer } from "@/components/shared/answer-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadCsv, slug } from "@/lib/csv";
import { questionTypeLabel } from "@/types/question";
import type { SurveyDetail } from "@/types/survey";
import { SectionedQuestions } from "./sectioned-questions";

/** The submitted response, as the reviewer, approver and admin see it, with a
 * CSV export for filing or analysis. */
export function AnswersReadOnly({ survey }: { survey: SurveyDetail }) {
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
    <Card>
      <CardHeader>
        <CardTitle>Response</CardTitle>
        <Button variant="secondary" size="sm" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        <SectionedQuestions
          survey={survey}
          render={(q, n) => (
            <div key={q.id}>
              <p className="text-sm text-ink-muted">
                {n}. {q.text}
              </p>
              <p className="mt-0.5 text-sm font-medium text-ink">{formatAnswer(survey.answers[q.id])}</p>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
}
