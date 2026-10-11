"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { bankKeys } from "@/lib/query-keys";
import type { BankCategory, BankQuestion, QuestionFields } from "@/types/question";

export interface BankQuestionInput extends QuestionFields {
  id?: string;
  category_id: string;
}

/** Create (no id) or update (with id) a reusable question. */
export function useSaveBankQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: BankQuestionInput) =>
      id ? api.patch<BankQuestion>(`/questions/${id}/`, body) : api.post<BankQuestion>("/questions/", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: bankKeys.all }),
  });
}

export function useDeleteBankQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/questions/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: bankKeys.all }),
  });
}

/** Create (no id) or rename (with id) a question category. */
export function useSaveBankCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: string; label: string; description?: string }) =>
      id ? api.patch<BankCategory>(`/question-categories/${id}/`, body) : api.post<BankCategory>("/question-categories/", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: bankKeys.all }),
  });
}

export function useDeleteBankCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/question-categories/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: bankKeys.all }),
  });
}
