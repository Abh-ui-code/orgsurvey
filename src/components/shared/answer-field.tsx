"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionPart, SurveyQuestion } from "@/types/question";
import type { AnswerBase, AnswerValue, ExtraRow } from "@/types/survey";
import { cn } from "@/lib/utils";

type Shape = Pick<SurveyQuestion, "type" | "unit" | "parts" | "required">;

const MAX_EXTRA = 30;

/** A stored value as its answer proper and the extra rows that came with it. */
export function splitAnswer(value: AnswerValue | undefined): { answer: AnswerBase | null | undefined; extra: ExtraRow[] } {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) return { answer: value.answer, extra: value.extra ?? [] };
  return { answer: value, extra: [] };
}

function joinAnswer(answer: AnswerBase | null | undefined, extra: ExtraRow[]): AnswerValue {
  return extra.length === 0 ? (answer ?? "") : { answer: answer ?? "", extra };
}

const blank = (v: unknown) => v === undefined || v === null || v === "";

/** What a table question has been filled in with: one slot per row. */
function slots(answer: AnswerBase | null | undefined, parts: QuestionPart[]): (string | number)[] {
  const list = Array.isArray(answer) ? (answer as (string | number)[]) : [];
  return parts.map((_, i) => list[i] ?? "");
}

/** True when a value counts as an answer (not blank, not an empty selection). For a table: every row filled when
 * the question is required, at least one otherwise, the same rule the server applies. Extra rows alone never count. */
export function isAnswered(value: AnswerValue | undefined, question?: Pick<Shape, "type" | "required" | "parts">): boolean {
  const { answer } = splitAnswer(value);
  if (blank(answer)) return false;
  if (Array.isArray(answer)) {
    if (question?.type === "table") {
      const filled = slots(answer, question.parts).filter((v) => !blank(v)).length;
      return question.required ? filled === question.parts.length : filled > 0;
    }
    return answer.length > 0;
  }
  return true;
}

/** An answer as plain text: "50 hectares", "Total area: 50 ha", extra rows listed after it, a dash when empty. */
export function formatAnswer(value: AnswerValue | undefined, question?: Pick<Shape, "type" | "unit" | "parts">): string {
  const { answer, extra } = splitAnswer(value);
  const lines: string[] = [];
  if (!blank(answer) && !(Array.isArray(answer) && answer.length === 0)) {
    if (Array.isArray(answer) && question?.type === "table") {
      slots(answer, question.parts).forEach((v, i) => {
        const part = question.parts[i];
        if (!blank(v)) lines.push(`${part.label}: ${v}${part.unit ? ` ${part.unit}` : ""}`);
      });
    } else if (Array.isArray(answer)) lines.push(answer.join(", "));
    else lines.push(`${answer}${question?.type === "number" && question.unit ? ` ${question.unit}` : ""}`);
  }
  for (const r of extra) lines.push(r.label ? `${r.label}: ${r.value}` : r.value);
  return lines.length ? lines.join("\n") : "—";
}

function ChoiceButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1.5 text-sm transition-colors",
        active ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-paper-raised text-ink-muted hover:bg-paper-sunken",
      )}
    >
      {children}
    </button>
  );
}

/** A box that takes only a figure, with its unit sitting beside it so it never has to be typed. */
function NumberBox({ value, onChange, unit, label, className }: { value: string | number | undefined; onChange: (next: number | "") => void; unit?: string; label: string; className?: string }) {
  // Keeps what is being typed ("5.", "-") while the stored value is still a plain number.
  const [text, setText] = useState(blank(value) ? "" : String(value));
  useEffect(() => {
    if (blank(value) ? text !== "" && text !== "-" && text !== "." : Number(text) !== value) setText(blank(value) ? "" : String(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={cn("flex w-full max-w-sm", className)}>
      <Input
        type="text"
        inputMode="decimal"
        aria-label={unit ? `${label} (${unit})` : label}
        placeholder="0"
        className={cn("min-w-0 flex-1 tabular-nums", unit && "rounded-r-none")}
        value={text}
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (!/^-?\d*\.?\d*$/.test(raw)) return; // digits only
          setText(raw);
          if (raw === "") onChange("");
          else if (Number.isFinite(Number(raw)) && raw !== "-" && raw !== ".") onChange(Number(raw));
        }}
      />
      {unit && <span className="flex shrink-0 items-center rounded-r-md border border-l-0 border-line bg-paper-sunken px-3 text-sm text-ink-muted">{unit}</span>}
    </div>
  );
}

const CELL = "block px-4 py-2 sm:table-cell sm:align-middle";

/** The rows a respondent adds on their own: anything on the left, anything on the right. */
function ExtraRowsEditor({ rows, onChange }: { rows: ExtraRow[]; onChange: (next: ExtraRow[]) => void }) {
  return (
    <>
      {rows.map((r, i) => (
        <tr key={i} className="block border-t border-line first:border-t-0 sm:table-row">
          <td className={CELL}>
            <Input aria-label={`Extra row ${i + 1}: item`} placeholder="Item" value={r.label} maxLength={200} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          </td>
          <td className={CELL}>
            <div className="flex items-center gap-2">
              <Input aria-label={`Extra row ${i + 1}: answer`} placeholder="Answer" value={r.value} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
              <button type="button" aria-label={`Remove extra row ${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))} className="shrink-0 rounded-md p-1.5 text-ink-faint hover:bg-paper-sunken hover:text-rust">
                <X className="h-4 w-4" />
              </button>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

function AddRowButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={count >= MAX_EXTRA}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-brand hover:bg-brand-soft disabled:opacity-50"
    >
      <Plus className="h-3.5 w-3.5" /> Add row
    </button>
  );
}

function TableShell({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-paper-raised">
      <table className="block w-full text-sm sm:table">
        <thead className="hidden bg-paper-sunken text-left text-2xs font-semibold uppercase tracking-wider text-ink-faint sm:table-header-group">
          <tr>
            <th className="w-2/5 px-4 py-2">Item</th>
            <th className="px-4 py-2">Answer</th>
          </tr>
        </thead>
        <tbody className="block divide-y divide-line sm:table-row-group">{children}</tbody>
      </table>
      {footer && <div className="border-t border-line bg-paper-sunken/40 px-2 py-1">{footer}</div>}
    </div>
  );
}

/** Input for one question, by type, with room to add rows of the respondent's own. Controlled: the parent owns the answers map. */
export function AnswerField({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  value: AnswerValue | undefined;
  onChange: (next: AnswerValue) => void;
}) {
  const { answer, extra } = splitAnswer(value);
  const set = (next: AnswerBase | null) => onChange(joinAnswer(next, extra));
  const setExtra = (rows: ExtraRow[]) => onChange(joinAnswer(answer, rows));
  const addRow = () => setExtra([...extra, { label: "", value: "" }]);

  if (question.type === "table") {
    const values = slots(answer, question.parts);
    const filled = values.filter((v) => !blank(v)).length;
    const partial = question.required && filled > 0 && filled < question.parts.length;
    return (
      <div className="space-y-1.5">
        <TableShell footer={<AddRowButton count={extra.length} onClick={addRow} />}>
          {question.parts.map((p, i) => (
            <tr key={i} className="block sm:table-row">
              <td className={cn(CELL, "pb-0 font-medium text-ink sm:w-2/5 sm:pb-2")}>{p.label}</td>
              <td className={CELL}>
                {p.kind === "number" ? (
                  <NumberBox label={p.label} unit={p.unit} value={values[i]} onChange={(n) => set(values.map((v, j) => (j === i ? n : v)))} />
                ) : p.kind === "date" ? (
                  <Input type="date" aria-label={p.label} className="max-w-48" value={typeof values[i] === "string" ? (values[i] as string) : ""} onChange={(e) => set(values.map((v, j) => (j === i ? e.target.value : v)))} />
                ) : (
                  <Textarea rows={2} aria-label={p.label} value={typeof values[i] === "string" ? (values[i] as string) : ""} placeholder="Type your answer" onChange={(e) => set(values.map((v, j) => (j === i ? e.target.value : v)))} />
                )}
              </td>
            </tr>
          ))}
          <ExtraRowsEditor rows={extra} onChange={setExtra} />
        </TableShell>
        {partial && <p className="text-xs text-rust">Fill in every row to submit this question.</p>}
      </div>
    );
  }

  const field = (() => {
    switch (question.type) {
      case "text":
        return <Textarea rows={3} value={typeof answer === "string" ? answer : ""} onChange={(e) => set(e.target.value)} placeholder="Type your answer" />;
      case "short_text":
        return (
          <div className="flex w-full max-w-xs">
            <Input
              aria-label={question.unit ? `${question.text} (${question.unit})` : question.text}
              maxLength={200}
              className={cn("min-w-0 flex-1", question.unit && "rounded-r-none")}
              value={typeof answer === "string" ? answer : ""}
              onChange={(e) => set(e.target.value)}
            />
            {question.unit && <span className="flex shrink-0 items-center rounded-r-md border border-l-0 border-line bg-paper-sunken px-3 text-sm text-ink-muted">{question.unit}</span>}
          </div>
        );
      case "number":
        return <NumberBox label={question.text} unit={question.unit} value={typeof answer === "number" ? answer : undefined} onChange={set} />;
      case "date":
        return <Input type="date" className="max-w-48" value={typeof answer === "string" ? answer : ""} onChange={(e) => set(e.target.value)} />;
      case "rating":
        return (
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <ChoiceButton key={n} active={answer === n} onClick={() => set(n)}>
                {n}
              </ChoiceButton>
            ))}
          </div>
        );
      case "yes_no":
        return (
          <div className="flex gap-2">
            {["Yes", "No"].map((o) => (
              <ChoiceButton key={o} active={answer === o} onClick={() => set(o)}>
                {o}
              </ChoiceButton>
            ))}
          </div>
        );
      case "single_choice":
        return (
          <div className="flex flex-wrap gap-2">
            {question.options.map((o) => (
              <ChoiceButton key={o} active={answer === o} onClick={() => set(o)}>
                {o}
              </ChoiceButton>
            ))}
          </div>
        );
      case "multi_choice": {
        const selected = Array.isArray(answer) ? (answer as string[]) : [];
        return (
          <div className="space-y-2">
            {question.options.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm text-ink">
                <Checkbox checked={selected.includes(o)} onCheckedChange={(c) => set(c === true ? [...selected, o] : selected.filter((x) => x !== o))} />
                {o}
              </label>
            ))}
          </div>
        );
      }
    }
  })();

  return (
    <div className="space-y-2">
      {field}
      {extra.length > 0 && (
        <TableShell>
          <ExtraRowsEditor rows={extra} onChange={setExtra} />
        </TableShell>
      )}
      <AddRowButton count={extra.length} onClick={addRow} />
    </div>
  );
}

/** A submitted answer for reading: a table when there are rows, otherwise the value with its unit. */
export function AnswerView({ question, value, className }: { question: Pick<Shape, "type" | "unit" | "parts">; value: AnswerValue | undefined; className?: string }) {
  const { answer, extra } = splitAnswer(value);
  const rows: { label: string; text: string }[] = [];
  if (question.type === "table" && Array.isArray(answer)) {
    slots(answer, question.parts).forEach((v, i) => {
      const p = question.parts[i];
      rows.push({ label: p.label, text: blank(v) ? "—" : `${v}${p.unit ? ` ${p.unit}` : ""}` });
    });
  }
  const main = question.type === "table" ? "" : formatAnswer(answer as AnswerValue | undefined, question);
  for (const r of extra) rows.push({ label: r.label, text: r.value || "—" });
  if (!rows.length) return <p className={cn("whitespace-pre-wrap text-sm font-medium text-ink-muted", className)}>{main && main !== "—" ? main : "No answer"}</p>;
  return (
    <div className={cn("space-y-1.5", className)}>
      {main && main !== "—" && <p className="whitespace-pre-wrap text-sm font-medium text-ink-muted">{main}</p>}
      <dl className="overflow-hidden rounded-lg border border-line bg-paper-raised text-sm">
        {rows.map((r, i) => (
          <div key={i} className="grid gap-x-4 border-t border-line px-3 py-2 first:border-t-0 sm:grid-cols-[2fr_3fr]">
            <dt className="text-ink-muted">{r.label || "—"}</dt>
            <dd className="whitespace-pre-wrap font-medium text-ink">{r.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
