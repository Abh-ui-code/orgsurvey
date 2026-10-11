"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type Params } from "@/lib/api";
import { surveyKeys } from "@/lib/query-keys";
import type { Survey, SurveyDetail } from "@/types/survey";

export interface SurveyFilters extends Params {
  search?: string;
  category?: string;
  status?: string;
  target_unit?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

/** A page of surveys the signed-in person may see. Filtering, search and
 * ordering all happen on the server. */
export function useSurveyList(params: SurveyFilters, enabled = true) {
  return useQuery({
    queryKey: surveyKeys.list(params),
    queryFn: () => api.list<Survey>("/surveys/", params),
    placeholderData: (previous) => previous, // keep the old rows on screen while the next page loads
    enabled,
  });
}

/** The surveys waiting on the signed-in person, soonest due first. */
export function useSurveyTasks(params: { page?: number; page_size?: number } = {}) {
  return useQuery({
    queryKey: surveyKeys.tasks(params),
    queryFn: () => api.list<Survey>("/surveys/tasks/", params),
    placeholderData: (previous) => previous,
  });
}

/** One survey with its sections, answers and activity. */
export function useSurvey(id: string) {
  return useQuery({
    queryKey: surveyKeys.detail(id),
    queryFn: () => api.get<SurveyDetail>(`/surveys/${id}/`),
    retry: false,
    enabled: Boolean(id),
  });
}
