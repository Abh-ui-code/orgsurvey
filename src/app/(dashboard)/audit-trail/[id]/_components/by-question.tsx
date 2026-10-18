"use client";

import { ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/shared/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { QUESTION_STATUS, QuestionStatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QUESTION_STATUSES, type QuestionStatus, type SurveyDetail } from "@/types/survey";
import { QuestionTrail, trailOf, trailSummary } from "./question-trail";

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      active ? "border-brand bg-brand-soft text-brand-strong" : "border-line text-ink-muted hover:bg-paper-sunken",
    )}
  >
    {children}
  </button>
);

/** One row per question: who answers it, where it is, the answer now and what it was
 * before, and, opened up, its complete trail (every answer, change, return, pass,
 * approval and comment). Filter by stage, respondent or text; open or close all. */
export function ByQuestion({ survey }: { survey: SurveyDetail }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<QuestionStatus | "all">("all");
  const [who, setWho] = useState("all");
  const [search, setSearch] = useState("");
  const questions = survey.sections.flatMap((s) => s.questions);
  const counts = Object.fromEntries(QUESTION_STATUSES.map((s) => [s, questions.filter((q) => q.status === s).length])) as Record<QuestionStatus, number>;
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return questions.filter(
      (q) => (filter === "all" || q.status === filter) && (who === "all" || q.responder?.id === who) && (!needle || q.text.toLowerCase().includes(needle)),
    );
  }, [questions, filter, who, search]);
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const allOpen = rows.length > 0 && rows.every((q) => open.has(q.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Find a question" className="w-56" />
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by stage">
          {(["all", ...QUESTION_STATUSES] as const)
            .filter((s) => s === "all" || counts[s] > 0)
            .map((s) => (
              <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>
                {s === "all" ? "All" : QUESTION_STATUS[s].short} <span className="ml-1 font-mono-data">{s === "all" ? questions.length : counts[s]}</span>
              </Chip>
            ))}
        </div>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setOpen(allOpen ? new Set() : new Set(rows.map((q) => q.id)))}>
          {allOpen ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
          {allOpen ? "Collapse all" : "Expand all"}
        </Button>
      </div>
      {survey.respondents.length > 1 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by respondent">
          <span className="text-xs text-ink-muted">Respondent</span>
          <Chip active={who === "all"} onClick={() => setWho("all")}>
            Everyone
          </Chip>
          {survey.respondents.map((r) => (
            <Chip key={r.person.id} active={who === r.person.id} onClick={() => setWho(r.person.id)}>
              {r.person.full_name} <span className="ml-1 font-mono-data">{r.stats.total}</span>
            </Chip>
          ))}
        </div>
      )}

      <Card>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-muted">No questions match.</p>
        ) : (
          <ul>
            {rows.map((q) => {
              const isOpen = open.has(q.id);
              const sum = trailSummary(trailOf(survey, q));
              return (
                <li key={q.id} className="border-b border-line last:border-b-0">
                  <button type="button" aria-expanded={isOpen} onClick={() => toggle(q.id)} className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-paper-sunken/50">
                    <ChevronRight className={cn("mt-0.5 h-4 w-4 shrink-0 text-ink-faint transition-transform", isOpen && "rotate-90")} />
                    <span className="w-9 shrink-0 font-mono-data text-xs font-semibold text-ink-faint">Q{q.number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ink">{q.text}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                        {sum.answer !== undefined ? (
                          <span>
                            Answer: <span className="font-medium text-ink">{sum.answer === "—" ? "none" : sum.answer}</span>
                            {sum.was !== undefined && <span className="text-ink-faint"> (was {sum.was === "—" ? "none" : sum.was})</span>}
                          </span>
                        ) : (
                          <span className="text-ink-faint">Not answered yet</span>
                        )}
                        {sum.revisions > 1 && <Badge tone="amber">{sum.revisions} revisions</Badge>}
                        {sum.returns > 0 && <Badge tone="rust">Returned {sum.returns}×</Badge>}
                        {sum.notes > 0 && (
                          <span>
                            {sum.notes} comment{sum.notes === 1 ? "" : "s"}
                          </span>
                        )}
                      </span>
                    </span>
                    {q.responder && (
                      <span className="hidden shrink-0 items-center gap-1.5 text-xs text-ink-muted md:flex">
                        <Avatar name={q.responder.full_name} className="h-5 w-5 text-2xs" /> {q.responder.full_name}
                      </span>
                    )}
                    <QuestionStatusBadge status={q.status} />
                  </button>
                  {isOpen && (
                    <div className="mb-4 ml-[3.25rem] mr-5">
                      <QuestionTrail survey={survey} question={q} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
