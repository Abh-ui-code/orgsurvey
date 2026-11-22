"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_ROW_HEADER, DEFAULT_VALUE_HEADER, type QuestionPart, type SurveyQuestion } from "@/types/question";
import type { AnswerBase, AnswerValue, ExtraRow } from "@/types/survey";
import { cn } from "@/lib/utils";

type Shape = Pick<SurveyQuestion, "type" | "unit" | "parts" | "required" | "row_header" | "value_header">;

const MAX_EXTRA = 30;
const MAX_COLUMNS = 5;

/** A stored value as its answer proper and the extra rows that came with it. */
export function splitAnswer(value: AnswerValue | undefined): { answer: AnswerBase | null | undefined; extra: ExtraRow[]; columns: string[]; cells: string[][] } {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) return { answer: value.answer, extra: value.extra ?? [], columns: value.columns ?? [], cells: value.cells ?? [] };
  return { answer: value, extra: [], columns: [], cells: [] };
}

function joinAnswer(answer: AnswerBase | null | undefined, extra: ExtraRow[], columns: string[] = [], cells: string[][] = []): AnswerValue {
  if (extra.length === 0 && columns.length === 0) return answer ?? "";
  return columns.length ? { answer: answer ?? "", extra, columns, cells } : { answer: answer ?? "", extra };
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
  const { answer, extra, columns, cells } = splitAnswer(value);
  const lines: string[] = [];
  const colText = (vals: (string | undefined)[] | undefined) =>
    columns.map((c, j) => (vals?.[j] ? `${c || `Column ${j + 1}`}: ${vals[j]}` : "")).filter(Boolean);
  if (!blank(answer) && !(Array.isArray(answer) && answer.length === 0)) {
    if (Array.isArray(answer) && question?.type === "table") {
      slots(answer, question.parts).forEach((v, i) => {
        const part = question.parts[i];
        const cols = colText(cells[i]);
        if (!blank(v) || cols.length) lines.push([`${part.label}: ${blank(v) ? "—" : v}${!blank(v) && part.unit ? ` ${part.unit}` : ""}`, ...cols].join("; "));
      });
    } else if (Array.isArray(answer)) lines.push(answer.join(", "));
    else lines.push(`${answer}${question?.type === "number" && question.unit ? ` ${question.unit}` : ""}`);
  }
  for (const r of extra) lines.push([r.label ? `${r.label}: ${r.value}` : r.value, ...colText(r.cols)].join("; "));
  return lines.length ? lines.join("\n") : "—";
}

/** Every cell of an answer as {key, label, text}, so two submissions can be compared cell by cell. */
export function answerCells(value: AnswerValue | undefined, question?: Pick<Shape, "type" | "unit" | "parts">): { key: string; label: string; text: string }[] {
  const { answer, extra, columns, cells } = splitAnswer(value);
  const out: { key: string; label: string; text: string }[] = [];
  const colName = (j: number) => columns[j] || `Column ${j + 1}`;
  if (Array.isArray(answer) && question?.type === "table") {
    slots(answer, question.parts).forEach((v, i) => {
      const p = question.parts[i];
      out.push({ key: `r${i}`, label: p.label, text: blank(v) ? "" : `${v}${p.unit ? ` ${p.unit}` : ""}` });
      columns.forEach((_, j) => out.push({ key: `r${i}c${j}`, label: `${p.label} · ${colName(j)}`, text: cells[i]?.[j] ?? "" }));
    });
  }
  extra.forEach((r, i) => {
    const name = r.label || `Added row ${i + 1}`;
    out.push({ key: `x${i}`, label: name, text: r.value || "" });
    columns.forEach((_, j) => out.push({ key: `x${i}c${j}`, label: `${name} · ${colName(j)}`, text: r.cols?.[j] ?? "" }));
  });
  return out;
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

/** An input that reads as plain text until it is hovered or focused, so a typed heading or label matches the fixed ones. */
const PLAIN = "border-transparent bg-transparent shadow-none hover:border-line focus:border-brand focus:bg-paper-raised";
/** A delete button that shows when its row or column (a `group`) is hovered or focused; always shown on touch screens. */
const HOVER_X = "shrink-0 rounded-md text-ink-faint opacity-0 transition-opacity hover:bg-paper-raised hover:text-rust focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100";
const CELL = "block px-4 py-2 sm:table-cell sm:align-middle";

/** The rows a respondent adds on their own: anything on the left, anything on the right. */
function ExtraRowsEditor({ rows, onChange, columns = [] }: { rows: ExtraRow[]; onChange: (next: ExtraRow[]) => void; columns?: string[] }) {
  return (
    <>
      {rows.map((r, i) => (
        <tr key={i} className="group block border-t border-line first:border-t-0 sm:table-row">
          <td className={cn(CELL, "sm:border-r sm:border-line")}>
            <div className="flex items-center gap-2">
              <Input aria-label={`Extra row ${i + 1}: item`} placeholder="Item" className={cn(PLAIN, "-ml-2 px-2 font-medium text-ink")} value={r.label} maxLength={200} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <RemoveRow n={i + 1} onClick={() => onChange(rows.filter((_, j) => j !== i))} />
            </div>
          </td>
          <td className={CELL}>
            <Textarea rows={2} aria-label={`Extra row ${i + 1}: answer`} placeholder="Type your answer" value={r.value} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
          </td>
          {columns.map((c, j) => (
            <td key={j} className={cn(CELL, "sm:border-l sm:border-line")}>
              <Textarea
                  rows={2}
                  aria-label={`Extra row ${i + 1}: ${c || `column ${j + 1}`}`}
                  placeholder={c || `Column ${j + 1}`}
                  value={r.cols?.[j] ?? ""}
                  onChange={(e) => onChange(rows.map((x, k) => (k === i ? { ...x, cols: columns.map((_, m) => (m === j ? e.target.value : (x.cols?.[m] ?? ""))) } : x)))}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function RemoveRow({ n, onClick }: { n: number; onClick: () => void }) {
  return (
    <button type="button" aria-label={`Remove extra row ${n}`} onClick={onClick} className={HOVER_X + " p-1.5"}>
      <X className="h-4 w-4" />
    </button>
  );
}

function AddColumnButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={count >= MAX_COLUMNS}
      title={count >= MAX_COLUMNS ? `Up to ${MAX_COLUMNS} columns` : undefined}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-brand hover:bg-brand-soft disabled:opacity-50"
    >
      <Plus className="h-3.5 w-3.5" /> Add column
    </button>
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

/** The table frame. Its two column headings are fixed by the question, so everyone reads the columns the same way. */
function PlusColumn({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={count >= MAX_COLUMNS}
      aria-label="Add column"
      title={count >= MAX_COLUMNS ? `Up to ${MAX_COLUMNS} columns` : "Add column"}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-brand hover:bg-brand-soft disabled:opacity-40"
    >
      <Plus className="h-4 w-4" />
    </button>
  );
}

function TableShell({
  children,
  footer,
  rowHeader,
  valueHeader,
  columns = [],
  onRenameColumn,
  onRemoveColumn,
  onAddColumn,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  rowHeader?: string;
  valueHeader?: string;
  columns?: string[];
  onRenameColumn?: (j: number, name: string) => void;
  onRemoveColumn?: (j: number) => void;
  onAddColumn?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-paper-raised">
      <div className="overflow-x-auto">
      <table className="block w-full text-sm sm:table">
        <thead className="hidden bg-paper-sunken text-left text-2xs font-semibold uppercase tracking-wider text-ink-faint sm:table-header-group">
          <tr>
            <th scope="col" className="w-2/5 px-4 py-2 sm:border-r sm:border-line">{rowHeader || DEFAULT_ROW_HEADER}</th>
            <th scope="col" className="px-4 py-1.5">
              <div className="flex items-center justify-between gap-2">
                {valueHeader || DEFAULT_VALUE_HEADER}
                {onAddColumn && columns.length === 0 && <PlusColumn count={0} onClick={onAddColumn} />}
              </div>
            </th>
            {columns.map((c, j) => (
              <th key={j} scope="col" className="group min-w-40 border-l border-line px-4 py-1.5">
                <div className="flex items-center gap-1">
                  <Input aria-label={`Column ${j + 1} heading`} placeholder={`Column ${j + 1} name`} maxLength={80} value={c} onChange={(e) => onRenameColumn?.(j, e.target.value)} className={cn(PLAIN, "-ml-2 h-8 px-2 text-2xs font-semibold uppercase tracking-wider text-ink-faint placeholder:normal-case placeholder:tracking-normal")} />
                  <button type="button" aria-label={`Remove column ${c || j + 1}`} onClick={() => onRemoveColumn?.(j)} className={HOVER_X + " p-1"}>
                    <X className="h-4 w-4" />
                  </button>
                  {onAddColumn && j === columns.length - 1 && <PlusColumn count={columns.length} onClick={onAddColumn} />}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="block divide-y divide-line sm:table-row-group">{children}</tbody>
      </table>
      </div>
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
  const { answer, extra, columns, cells } = splitAnswer(value);
  const set = (next: AnswerBase | null) => onChange(joinAnswer(next, extra, columns, cells));
  const setExtra = (rows: ExtraRow[]) => onChange(joinAnswer(answer, rows, columns, cells));
  const addRow = () => setExtra([...extra, { label: "", value: "", ...(columns.length ? { cols: columns.map(() => "") } : {}) }]);

  // Columns the respondent adds to a table: every row, the question's own and the added ones, gets a cell in each.
  const cellAt = (i: number, j: number) => cells[i]?.[j] ?? "";
  const grid = (cols: string[]) => question.parts.map((_, i) => cols.map((__, j) => cellAt(i, j)));
  const addColumn = () => {
    const next = [...columns, ""];
    onChange(joinAnswer(answer, extra.map((r) => ({ ...r, cols: next.map((_, j) => r.cols?.[j] ?? "") })), next, grid(next)));
  };
  const renameColumn = (j: number, name: string) => onChange(joinAnswer(answer, extra, columns.map((c, k) => (k === j ? name : c)), grid(columns)));
  const removeColumn = (j: number) => {
    const next = columns.filter((_, k) => k !== j);
    onChange(joinAnswer(answer, extra.map((r) => ({ ...r, cols: (r.cols ?? []).filter((_, k) => k !== j) })), next, grid(columns).map((row) => row.filter((_, k) => k !== j))));
  };
  const setCell = (i: number, j: number, v: string) => onChange(joinAnswer(answer, extra, columns, grid(columns).map((row, r) => (r === i ? row.map((c, k) => (k === j ? v : c)) : row))));

  if (question.type === "table") {
    const values = slots(answer, question.parts);
    const filled = values.filter((v) => !blank(v)).length;
    const partial = question.required && filled > 0 && filled < question.parts.length;
    return (
      <div className="space-y-1.5">
        <TableShell
          rowHeader={question.row_header}
          valueHeader={question.value_header}
          columns={columns}
          onRenameColumn={renameColumn}
          onRemoveColumn={removeColumn}
          onAddColumn={addColumn}
          footer={
            <div className="flex flex-wrap gap-1">
              <AddRowButton count={extra.length} onClick={addRow} />
              {/* The header's + is hidden on phones, where the header row is, so the button stays here for them. */}
              <span className="sm:hidden">
                <AddColumnButton count={columns.length} onClick={addColumn} />
              </span>
            </div>
          }
        >
          {question.parts.map((p, i) => (
            <tr key={i} className="block sm:table-row">
              <td className={cn(CELL, "pb-0 font-medium text-ink sm:w-2/5 sm:border-r sm:border-line sm:pb-2")}>{p.label}</td>
              <td className={CELL}>
                {p.kind === "number" ? (
                  <NumberBox label={p.label} unit={p.unit} value={values[i]} onChange={(n) => set(values.map((v, j) => (j === i ? n : v)))} />
                ) : p.kind === "yes_no" ? (
                  <div className="flex gap-2">
                    {["Yes", "No"].map((o) => (
                      <ChoiceButton key={o} active={values[i] === o} onClick={() => set(values.map((v, j) => (j === i ? (v === o ? "" : o) : v)))}>
                        {o}
                      </ChoiceButton>
                    ))}
                  </div>
                ) : p.kind === "date" ? (
                  <Input type="date" aria-label={p.label} className="max-w-48" value={typeof values[i] === "string" ? (values[i] as string) : ""} onChange={(e) => set(values.map((v, j) => (j === i ? e.target.value : v)))} />
                ) : (
                  <Textarea rows={2} aria-label={p.label} value={typeof values[i] === "string" ? (values[i] as string) : ""} placeholder="Type your answer" onChange={(e) => set(values.map((v, j) => (j === i ? e.target.value : v)))} />
                )}
              </td>
              {columns.map((c, j) => (
                <td key={j} className={cn(CELL, "sm:border-l sm:border-line")}>
                  <Textarea rows={2} aria-label={`${p.label}: ${c || `column ${j + 1}`}`} placeholder={c || `Column ${j + 1}`} value={cellAt(i, j)} onChange={(e) => setCell(i, j, e.target.value)} />
                </td>
              ))}
            </tr>
          ))}
          <ExtraRowsEditor rows={extra} onChange={setExtra} columns={columns} />
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
export function AnswerView({ question, value, className }: { question: Pick<Shape, "type" | "unit" | "parts" | "row_header" | "value_header">; value: AnswerValue | undefined; className?: string }) {
  const { answer, extra, columns, cells } = splitAnswer(value);
  const rows: { label: string; text: string; cols: string[] }[] = [];
  const colsOf = (v?: string[]) => columns.map((_, j) => v?.[j] || "—");
  const template = { gridTemplateColumns: `2fr 3fr${columns.map(() => " 2fr").join("")}` };
  if (question.type === "table" && Array.isArray(answer)) {
    slots(answer, question.parts).forEach((v, i) => {
      const p = question.parts[i];
      rows.push({ label: p.label, text: blank(v) ? "—" : `${v}${p.unit ? ` ${p.unit}` : ""}`, cols: colsOf(cells[i]) });
    });
  }
  const main = question.type === "table" ? "" : formatAnswer(answer as AnswerValue | undefined, question);
  for (const r of extra) rows.push({ label: r.label, text: r.value || "—", cols: colsOf(r.cols) });
  if (!rows.length) return <p className={cn("whitespace-pre-wrap text-sm font-medium text-ink-muted", className)}>{main && main !== "—" ? main : "No answer"}</p>;
  return (
    <div className={cn("space-y-1.5", className)}>
      {main && main !== "—" && <p className="whitespace-pre-wrap text-sm font-medium text-ink-muted">{main}</p>}
      <dl className="overflow-hidden rounded-lg border border-line bg-paper-raised text-sm">
        {question.type === "table" && (
          <div className="hidden bg-paper-sunken text-2xs font-semibold uppercase tracking-wider text-ink-faint sm:grid" style={template}>
            <dt className="border-r border-line px-3 py-2">{question.row_header || DEFAULT_ROW_HEADER}</dt>
            <dd className="px-3 py-2">{question.value_header || DEFAULT_VALUE_HEADER}</dd>
            {columns.map((c, j) => (
              <dd key={j} className="border-l border-line px-3 py-2">{c || `Column ${j + 1}`}</dd>
            ))}
          </div>
        )}
        {rows.map((r, i) => (
          <div key={i} className="grid border-t border-line first:border-t-0 sm:[grid-template-columns:var(--cols)]" style={{ "--cols": template.gridTemplateColumns } as React.CSSProperties}>
            <dt className="px-3 pt-2 text-ink-muted sm:border-r sm:border-line sm:py-2">{r.label || "—"}</dt>
            <dd className="whitespace-pre-wrap px-3 pb-2 pt-0.5 font-medium text-ink sm:py-2">{r.text}</dd>
            {r.cols.map((c, j) => (
              <dd key={j} className="whitespace-pre-wrap px-3 pb-2 pt-0.5 text-ink sm:border-l sm:border-line sm:py-2">
                <span className="mr-1 text-2xs uppercase text-ink-faint sm:hidden">{columns[j] || `Column ${j + 1}`}:</span>
                {c}
              </dd>
            ))}
          </div>
        ))}
      </dl>
    </div>
  );
}
