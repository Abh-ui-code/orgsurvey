"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { surveyCategoryKeys } from "@/lib/query-keys";
import type { SurveyCategory } from "@/types/survey";

/** The topics surveys are filed under. Used by the survey list's filter, the
 * create drawer, the builder and Settings. */
export function useSurveyCategories() {
  return useQuery({
    queryKey: surveyCategoryKeys.list(),
    queryFn: () => api.get<SurveyCategory[]>("/survey-categories/"),
    staleTime: 5 * 60_000,
  });
}
