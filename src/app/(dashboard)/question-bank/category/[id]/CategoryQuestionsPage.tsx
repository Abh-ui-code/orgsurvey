"use client";

import { ArrowLeft, BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/permission-gate";
import { IconButton } from "@/components/shared/icon-button";
import { EMPTY_QUESTION, draftFromQuestion } from "@/components/shared/question-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { useBankCategories } from "@/hooks/use-bank-categories";
import { useBankQuestions } from "@/hooks/use-bank-questions";
import { useDebounced } from "@/hooks/use-debounced";
import { questionKindLabel, type BankQuestion } from "@/types/question";
import { QuestionDialog, type BankDraft } from "../../_components/question-dialog";
import { useDeleteBankQuestion } from "../../_hooks/use-question-bank";

/** The questions in one category (or all of them) on a page of their own. */
function CategoryQuestions() {
  const { id } = useParams<{ id: string }>();
  const category = id === "all" ? "" : id;
  const categories = useBankCategories();
  const del = useDeleteBankQuestion();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [draft, setDraft] = useState<BankDraft | null>(null);
  const [toDelete, setToDelete] = useState<BankQuestion | null>(null);

  const questions = useBankQuestions({ search: useDebounced(search), category, page, page_size: pageSize });
  const blank: BankDraft = { ...EMPTY_QUESTION, category_id: category || categories.data?.[0]?.id || "" };
  const title = id === "all" ? "All questions" : (categories.data?.find((x) => x.id === id)?.label ?? "Category");

  const columns: ColumnDef<BankQuestion>[] = [
    {
      key: "text",
      label: "Question",
      render: (q) => (
        <div>
          <div className="text-ink">{q.text}</div>
          {q.hint && <div className="text-xs text-ink-faint">{q.hint}</div>}
        </div>
      ),
    },
    { key: "type", label: "Type", render: (q) => questionKindLabel(q) },
    { key: "category", label: "Category", render: (q) => <Badge>{q.category.label}</Badge> },
    {
      key: "actions",
      label: "",
      className: "w-24 text-right",
      render: (q) => (
        <div className="flex justify-end gap-1">
          <IconButton label="Edit question" onClick={() => setDraft({ ...draftFromQuestion(q), id: q.id, category_id: q.category.id })}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton label="Delete question" onClick={() => setToDelete(q)}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/question-bank" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> Question bank
          </Link>
          <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        </div>
        <Button onClick={() => setDraft(blank)}>
          <Plus className="h-4 w-4" /> Add question
        </Button>
      </div>
      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search questions"
          className="w-72"
        />
      </div>
      <DataTable
        columns={columns}
        data={questions.data?.results ?? []}
        isLoading={questions.isPending}
        isFetching={questions.isFetching}
        isError={questions.isError}
        emptyIcon={BookOpen}
        emptyTitle="No questions yet"
        emptyDescription="Add reusable questions to build surveys from."
        emptyAction={<Button onClick={() => setDraft(blank)}>Add question</Button>}
        pagination={{ page, pageSize, total: questions.data?.count ?? 0 }}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
      <QuestionDialog draft={draft} onClose={() => setDraft(null)} />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        variant="danger"
        title="Delete this question?"
        description="Surveys already built keep their own copy, so they are not affected."
        confirmLabel="Delete"
        loading={del.isPending}
        onConfirm={() =>
          toDelete &&
          del.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success("Question deleted");
              setToDelete(null);
            },
          })
        }
      />
    </>
  );
}

export default function CategoryQuestionsPage() {
  return (
    <PermissionGate module="question_bank" featureName="the question bank">
      <CategoryQuestions />
    </PermissionGate>
  );
}
