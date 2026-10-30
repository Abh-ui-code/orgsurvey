"use client";

import { BookOpen, FolderCog, Pencil, Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/permission-gate";
import { IconButton } from "@/components/shared/icon-button";
import { EMPTY_QUESTION, draftFromQuestion } from "@/components/shared/question-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { useGriStandards } from "@/hooks/use-gri-standards";
import { useBankCategories } from "@/hooks/use-bank-categories";
import { useBankQuestions } from "@/hooks/use-bank-questions";
import { useDebounced } from "@/hooks/use-debounced";
import { questionTypeLabel, type BankQuestion } from "@/types/question";
import { GRI_CATEGORY, GriTab } from "./_components/gri-tab";
import { CategoriesDialog } from "./_components/categories-dialog";
import { QuestionDialog, type BankDraft } from "./_components/question-dialog";
import { useDeleteBankQuestion } from "./_hooks/use-question-bank";

function QuestionBank() {
  const categories = useBankCategories();
  const del = useDeleteBankQuestion();
  const [search, setSearch] = useState("");
  // Arriving from a GRI standard's page lands back on the GRI standards.
  const [category, setCategory] = useState(useSearchParams().get("category") === GRI_CATEGORY ? GRI_CATEGORY : "");
  const gri = category === GRI_CATEGORY;
  const griCount = useGriStandards().data?.length;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [draft, setDraft] = useState<BankDraft | null>(null);
  const [toDelete, setToDelete] = useState<BankQuestion | null>(null);
  const [manage, setManage] = useState(false);

  const questions = useBankQuestions({ search: useDebounced(search), category: gri ? "" : category, page, page_size: pageSize }, !gri);
  const blank: BankDraft = { ...EMPTY_QUESTION, category_id: category || categories.data?.[0]?.id || "" };

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
    { key: "type", label: "Type", render: (q) => questionTypeLabel(q.type) },
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
      <PageHeader
        title="Question bank"
        description="Reusable questions that surveys are built from."
        actions={
          !gri && (
            <>
              <Button variant="secondary" onClick={() => setManage(true)}>
                <FolderCog className="h-4 w-4" /> Categories
              </Button>
              <Button onClick={() => setDraft(blank)}>
                <Plus className="h-4 w-4" /> Add question
              </Button>
            </>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder={gri ? "Search GRI standards" : "Search questions"}
          className="w-72"
        />
        <Select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="w-56"
        >
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label} ({c.question_count})
            </option>
          ))}
          <option value={GRI_CATEGORY}>GRI standards{griCount !== undefined ? ` (${griCount})` : ""}</option>
        </Select>
      </div>
      {gri ? (
        <GriTab search={search} />
      ) : (
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
      )}
      <QuestionDialog draft={draft} onClose={() => setDraft(null)} />
      <CategoriesDialog open={manage} onClose={() => setManage(false)} />
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

export default function QuestionBankPage() {
  return (
    <PermissionGate module="question_bank" featureName="the question bank">
      <QuestionBank />
    </PermissionGate>
  );
}
