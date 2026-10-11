"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type Params } from "@/lib/api";
import { bankKeys } from "@/lib/query-keys";
import type { BankQuestion } from "@/types/question";

export interface BankFilters extends Params {
  search?: string;
  category?: string;
  page?: number;
  page_size?: number;
}

/** A page of reusable questions. Used by the question bank and by the survey
 * builder's "from the bank" picker; search and filtering run on the server. */
export function useBankQuestions(params: BankFilters, enabled = true) {
  return useQuery({
    queryKey: bankKeys.questions(params),
    queryFn: () => api.list<BankQuestion>("/questions/", params),
    placeholderData: (previous) => previous,
    enabled,
  });
}
