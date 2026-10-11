"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { bankKeys } from "@/lib/query-keys";
import type { BankCategory } from "@/types/question";

/** The topics reusable questions are filed under. Used by the question bank
 * and by the builder's "from the bank" picker. */
export function useBankCategories() {
  return useQuery({
    queryKey: bankKeys.categories(),
    queryFn: () => api.get<BankCategory[]>("/question-categories/"),
    staleTime: 5 * 60_000,
  });
}
