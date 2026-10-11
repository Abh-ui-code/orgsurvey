"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { reportKeys, surveyKeys } from "@/lib/query-keys";
import type { SurveyDetail } from "@/types/survey";

export interface NewSurveyInput {
  title: string;
  category_id: string;
  target_unit_id: string;
  description: string;
}

/** Starts a draft survey; the builder takes it from there. */
export function useCreateSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewSurveyInput) => api.post<SurveyDetail>("/surveys/", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: surveyKeys.all });
      qc.invalidateQueries({ queryKey: reportKeys.all });
    },
  });
}
